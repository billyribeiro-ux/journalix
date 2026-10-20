//! Provider secret storage.
//!
//! Secrets are JSON maps (`{"apiKey": "…"}`) stored in the operating system's credential store
//! under service [`SERVICE`] with the provider configuration id as the account name:
//! Keychain on macOS, Credential Manager on Windows and the Secret Service (GNOME Keyring,
//! KWallet) on Linux.
//!
//! Linux machines without a Secret Service daemon (headless servers, minimal window managers)
//! fall back to the `app_secrets` table, encrypted with ChaCha20-Poly1305 under a random
//! 32-byte key kept in a `0600` file next to the database. macOS and Windows never fall back.

use std::path::PathBuf;
use std::sync::OnceLock;

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use rusqlite::{Connection, OptionalExtension, params};

use crate::error::{AppError, AppResult};

/// Credential-store service name for every Journalix secret.
pub const SERVICE: &str = "com.journalix.desktop";

const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

/// Where secrets live. `conn` is the caller's connection or open transaction, so database-backed
/// stores take part in the same transaction as the configuration change.
pub trait SecretStore: Send + Sync {
    fn get(&self, conn: &Connection, account: &str) -> AppResult<Option<String>>;
    fn set(&self, conn: &Connection, account: &str, value: &str) -> AppResult<()>;
    fn delete(&self, conn: &Connection, account: &str) -> AppResult<()>;
}

// ---------------------------------------------------------------------------------------------
// Encrypted database store (Linux fallback, and the store used by tests)

/// Secrets encrypted with ChaCha20-Poly1305 in the `app_secrets` table.
/// The account name is bound as associated data, so rows cannot be swapped between providers.
pub struct EncryptedDbStore {
    key_source: KeySource,
    cipher: OnceLock<ChaCha20Poly1305>,
}

enum KeySource {
    /// Read from (or created at) this path on first use.
    File(PathBuf),
    #[cfg(test)]
    Fixed([u8; KEY_LEN]),
}

impl EncryptedDbStore {
    pub fn with_key_file(path: PathBuf) -> Self {
        Self {
            key_source: KeySource::File(path),
            cipher: OnceLock::new(),
        }
    }

    #[cfg(test)]
    pub fn with_fixed_key(key: [u8; KEY_LEN]) -> Self {
        Self {
            key_source: KeySource::Fixed(key),
            cipher: OnceLock::new(),
        }
    }

    fn cipher(&self) -> AppResult<&ChaCha20Poly1305> {
        if let Some(cipher) = self.cipher.get() {
            return Ok(cipher);
        }
        let key_bytes = match &self.key_source {
            KeySource::File(path) => load_or_create_key(path)?,
            #[cfg(test)]
            KeySource::Fixed(key) => *key,
        };
        let key = Key::try_from(key_bytes.as_slice())
            .map_err(|_| AppError::SecretStore("Invalid encryption key length".into()))?;
        Ok(self.cipher.get_or_init(|| ChaCha20Poly1305::new(&key)))
    }
}

fn random_bytes<const N: usize>() -> AppResult<[u8; N]> {
    let mut bytes = [0_u8; N];
    getrandom::fill(&mut bytes).map_err(|error| {
        AppError::SecretStore(format!("The system random generator failed: {error}"))
    })?;
    Ok(bytes)
}

/// Reads the 32-byte key file, creating it with owner-only permissions when missing.
fn load_or_create_key(path: &std::path::Path) -> AppResult<[u8; KEY_LEN]> {
    use std::io::{ErrorKind, Read, Write};

    match std::fs::File::open(path) {
        Ok(mut file) => {
            let mut key = [0_u8; KEY_LEN];
            file.read_exact(&mut key)?;
            return Ok(key);
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }

    let key = random_bytes::<KEY_LEN>()?;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(path) {
        Ok(mut file) => {
            file.write_all(&key)?;
            file.sync_all()?;
            Ok(key)
        }
        // Another process created it first; use theirs.
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            let mut key = [0_u8; KEY_LEN];
            std::fs::File::open(path)?.read_exact(&mut key)?;
            Ok(key)
        }
        Err(error) => Err(error.into()),
    }
}

impl SecretStore for EncryptedDbStore {
    fn get(&self, conn: &Connection, account: &str) -> AppResult<Option<String>> {
        let row: Option<(Vec<u8>, Vec<u8>)> = conn
            .query_row(
                "SELECT nonce, ciphertext FROM app_secrets WHERE account = ?1",
                [account],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((nonce, ciphertext)) = row else {
            return Ok(None);
        };
        let nonce = Nonce::try_from(nonce.as_slice())
            .map_err(|_| AppError::SecretStore("Stored secret is corrupt".into()))?;
        let plain = self
            .cipher()?
            .decrypt(
                &nonce,
                Payload {
                    msg: &ciphertext,
                    aad: account.as_bytes(),
                },
            )
            .map_err(|_| {
                AppError::SecretStore(
                    "Stored secret could not be decrypted; re-enter the API key".into(),
                )
            })?;
        String::from_utf8(plain)
            .map(Some)
            .map_err(|_| AppError::SecretStore("Stored secret is not valid text".into()))
    }

    fn set(&self, conn: &Connection, account: &str, value: &str) -> AppResult<()> {
        let nonce_bytes = random_bytes::<NONCE_LEN>()?;
        let nonce = Nonce::try_from(nonce_bytes.as_slice())
            .map_err(|_| AppError::SecretStore("Invalid nonce length".into()))?;
        let ciphertext = self
            .cipher()?
            .encrypt(
                &nonce,
                Payload {
                    msg: value.as_bytes(),
                    aad: account.as_bytes(),
                },
            )
            .map_err(|_| AppError::SecretStore("Could not encrypt the secret".into()))?;
        conn.execute(
            "INSERT INTO app_secrets (account, nonce, ciphertext) VALUES (?1, ?2, ?3)
             ON CONFLICT (account) DO UPDATE SET nonce = excluded.nonce, ciphertext = excluded.ciphertext",
            params![account, nonce_bytes.as_slice(), ciphertext],
        )?;
        Ok(())
    }

    fn delete(&self, conn: &Connection, account: &str) -> AppResult<()> {
        conn.execute("DELETE FROM app_secrets WHERE account = ?1", [account])?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------------------------
// OS credential store

/// The platform credential store, with the encrypted-table fallback on Linux only.
pub struct KeychainStore {
    #[cfg(target_os = "linux")]
    fallback: EncryptedDbStore,
    /// Set once the Secret Service proved unavailable, so later calls skip straight to the
    /// fallback instead of waiting on D-Bus again.
    #[cfg(target_os = "linux")]
    unavailable: std::sync::atomic::AtomicBool,
}

impl KeychainStore {
    /// `key_file` holds the fallback encryption key (used on Linux only).
    pub fn new(key_file: PathBuf) -> Self {
        #[cfg(not(target_os = "linux"))]
        {
            let _ = key_file;
            Self {}
        }
        #[cfg(target_os = "linux")]
        {
            Self {
                fallback: EncryptedDbStore::with_key_file(key_file),
                unavailable: std::sync::atomic::AtomicBool::new(false),
            }
        }
    }

    fn entry(account: &str) -> Result<keyring::Entry, keyring::Error> {
        keyring::Entry::new(SERVICE, account)
    }
}

fn keyring_error(error: keyring::Error) -> AppError {
    AppError::SecretStore(error.to_string())
}

#[cfg(target_os = "linux")]
impl KeychainStore {
    fn use_fallback(&self) -> bool {
        self.unavailable.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Returns true (and switches to the fallback) when the error means "no usable backend".
    fn backend_missing(&self, error: &keyring::Error) -> bool {
        let missing = matches!(
            error,
            keyring::Error::PlatformFailure(_) | keyring::Error::NoStorageAccess(_)
        );
        if missing
            && !self
                .unavailable
                .swap(true, std::sync::atomic::Ordering::Relaxed)
        {
            log::warn!(
                "The Secret Service is unavailable ({error}); storing provider secrets \
                 encrypted in the app database instead"
            );
        }
        missing
    }
}

#[cfg(target_os = "linux")]
impl SecretStore for KeychainStore {
    fn get(&self, conn: &Connection, account: &str) -> AppResult<Option<String>> {
        if self.use_fallback() {
            return self.fallback.get(conn, account);
        }
        match Self::entry(account).and_then(|entry| entry.get_password()) {
            Ok(value) => Ok(Some(value)),
            // Secrets saved while the daemon was down live in the fallback table.
            Err(keyring::Error::NoEntry) => self.fallback.get(conn, account),
            Err(error) if self.backend_missing(&error) => self.fallback.get(conn, account),
            Err(error) => Err(keyring_error(error)),
        }
    }

    fn set(&self, conn: &Connection, account: &str, value: &str) -> AppResult<()> {
        if self.use_fallback() {
            return self.fallback.set(conn, account, value);
        }
        match Self::entry(account).and_then(|entry| entry.set_password(value)) {
            // Drop any copy left in the fallback so the keychain is the single source.
            Ok(()) => self.fallback.delete(conn, account),
            Err(error) if self.backend_missing(&error) => self.fallback.set(conn, account, value),
            Err(error) => Err(keyring_error(error)),
        }
    }

    fn delete(&self, conn: &Connection, account: &str) -> AppResult<()> {
        self.fallback.delete(conn, account)?;
        if self.use_fallback() {
            return Ok(());
        }
        match Self::entry(account).and_then(|entry| entry.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) if self.backend_missing(&error) => Ok(()),
            Err(error) => Err(keyring_error(error)),
        }
    }
}

#[cfg(not(target_os = "linux"))]
impl SecretStore for KeychainStore {
    fn get(&self, _conn: &Connection, account: &str) -> AppResult<Option<String>> {
        match Self::entry(account).and_then(|entry| entry.get_password()) {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(keyring_error(error)),
        }
    }

    fn set(&self, _conn: &Connection, account: &str, value: &str) -> AppResult<()> {
        Self::entry(account)
            .and_then(|entry| entry.set_password(value))
            .map_err(keyring_error)
    }

    fn delete(&self, _conn: &Connection, account: &str) -> AppResult<()> {
        match Self::entry(account).and_then(|entry| entry.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(keyring_error(error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn encrypted_store_round_trips_and_binds_account() -> AppResult<()> {
        let conn = db::open_in_memory()?;
        let store = EncryptedDbStore::with_fixed_key([7; KEY_LEN]);
        assert_eq!(store.get(&conn, "a")?, None);
        store.set(&conn, "a", r#"{"apiKey":"k-123"}"#)?;
        assert_eq!(
            store.get(&conn, "a")?.as_deref(),
            Some(r#"{"apiKey":"k-123"}"#)
        );

        // Ciphertext moved to another account must not decrypt.
        conn.execute(
            "INSERT INTO app_secrets (account, nonce, ciphertext)
             SELECT 'b', nonce, ciphertext FROM app_secrets WHERE account = 'a'",
            [],
        )?;
        assert!(store.get(&conn, "b").is_err());

        store.delete(&conn, "a")?;
        assert_eq!(store.get(&conn, "a")?, None);
        Ok(())
    }

    #[test]
    fn key_file_is_created_private_and_reused() -> AppResult<()> {
        let dir = tempfile::tempdir()?;
        let path = dir.path().join("secret.key");
        let first = load_or_create_key(&path)?;
        let second = load_or_create_key(&path)?;
        assert_eq!(first, second);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path)?.permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        Ok(())
    }
}
