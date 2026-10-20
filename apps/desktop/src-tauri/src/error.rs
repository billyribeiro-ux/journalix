//! Typed errors shared by every command. They reach the webview as `{ code, message }`.

use serde::ser::SerializeStruct;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// Input failed a domain invariant (empty name, negative price, …).
    #[error("{0}")]
    Validation(String),

    /// The requested record does not exist.
    #[error("{0}")]
    NotFound(String),

    /// A foreign key or uniqueness rule was violated.
    #[error("{0}")]
    Constraint(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Could not encode or decode stored data: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Secret storage error: {0}")]
    SecretStore(String),

    #[error("File system error: {0}")]
    Io(#[from] std::io::Error),

    /// Another thread panicked while holding the database lock.
    #[error("The database is unavailable after an internal error; restart Journalix")]
    LockPoisoned,

    #[error("Could not resolve the application data directory: {0}")]
    AppDir(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound(message.into())
    }

    /// Stable machine-readable code for the frontend.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Validation(_) => "validation",
            Self::NotFound(_) => "not_found",
            Self::Constraint(_) => "constraint",
            Self::Database(_) => "database",
            Self::Serialization(_) => "serialization",
            Self::SecretStore(_) => "secret_store",
            Self::Io(_) => "io",
            Self::LockPoisoned => "internal",
            Self::AppDir(_) => "app_dir",
            Self::Internal(_) => "internal",
        }
    }
}

/// Maps SQLite constraint failures to [`AppError::Constraint`] with a readable message.
pub fn map_db(error: rusqlite::Error) -> AppError {
    if let rusqlite::Error::SqliteFailure(code, detail) = &error
        && code.code == rusqlite::ErrorCode::ConstraintViolation
    {
        let detail = detail.as_deref().unwrap_or("constraint failed");
        let message = if detail.contains("FOREIGN KEY") {
            "A referenced record does not exist (check the account, playbook, tags and provider)"
                .to_owned()
        } else if detail.contains("UNIQUE") || detail.contains("PRIMARY KEY") {
            "An id is already used by another record".to_owned()
        } else {
            format!("Constraint failed: {detail}")
        };
        return AppError::Constraint(message);
    }
    AppError::Database(error)
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_code_and_message() -> Result<(), serde_json::Error> {
        let json = serde_json::to_value(AppError::validation("Name is required"))?;
        assert_eq!(
            json,
            serde_json::json!({ "code": "validation", "message": "Name is required" })
        );
        Ok(())
    }
}
