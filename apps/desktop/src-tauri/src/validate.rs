//! Field-level checks mirroring the Valibot schemas in `@journalix/core` (domain/schemas.ts).
//!
//! The webview validates before invoking, but the backend never trusts IPC input: every
//! invariant that protects stored data is enforced again here.

use crate::error::{AppError, AppResult};

/// Length as JavaScript counts it (UTF-16 code units), so limits match `v.maxLength`.
fn js_len(value: &str) -> usize {
    value.encode_utf16().count()
}

/// RFC 9562 textual UUID (any version), as accepted by Valibot's `v.uuid()`.
pub fn uuid(field: &str, value: &str) -> AppResult<()> {
    let bytes = value.as_bytes();
    let well_formed = bytes.len() == 36
        && bytes.iter().enumerate().all(|(i, b)| match i {
            8 | 13 | 18 | 23 => *b == b'-',
            _ => b.is_ascii_hexdigit(),
        });
    if well_formed {
        Ok(())
    } else {
        Err(AppError::validation(format!("{field}: invalid id")))
    }
}

/// ISO-8601 instant with an explicit offset or `Z`.
pub fn timestamp(field: &str, value: &str) -> AppResult<()> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|_| ())
        .map_err(|_| AppError::validation(format!("{field}: expected an ISO-8601 timestamp")))
}

/// Calendar date, `YYYY-MM-DD`.
pub fn date(field: &str, value: &str) -> AppResult<()> {
    let shaped = value.len() == 10
        && value.bytes().enumerate().all(|(i, b)| {
            if i == 4 || i == 7 {
                b == b'-'
            } else {
                b.is_ascii_digit()
            }
        });
    if shaped && chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field}: expected a YYYY-MM-DD date"
        )))
    }
}

/// Trims and enforces `1..=max` characters. Returns the trimmed value.
pub fn name(field: &str, value: &str, max: usize) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation(format!("{field} is required")));
    }
    max_len(field, trimmed, max)?;
    Ok(trimmed.to_owned())
}

pub fn max_len(field: &str, value: &str, max: usize) -> AppResult<()> {
    if js_len(value) > max {
        Err(AppError::validation(format!(
            "{field} must be at most {max} characters"
        )))
    } else {
        Ok(())
    }
}

pub fn finite(field: &str, value: f64) -> AppResult<()> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(AppError::validation(format!("{field} must be a number")))
    }
}

pub fn non_negative(field: &str, value: f64) -> AppResult<()> {
    finite(field, value)?;
    if value >= 0.0 {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field} must be zero or more"
        )))
    }
}

pub fn positive(field: &str, value: f64) -> AppResult<()> {
    finite(field, value)?;
    if value > 0.0 {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field} must be greater than zero"
        )))
    }
}

pub fn one_of(field: &str, value: &str, allowed: &[&str]) -> AppResult<()> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field}: unexpected value \"{value}\""
        )))
    }
}

/// Trims, upper-cases and checks a ticker (`SymbolSchema`). Returns the normalised symbol.
pub fn symbol(field: &str, value: &str) -> AppResult<String> {
    let normalised = value.trim().to_uppercase();
    if normalised.is_empty() {
        return Err(AppError::validation(format!("{field}: symbol is required")));
    }
    max_len(field, &normalised, 32)?;
    let valid = normalised
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || "./:^_-".contains(c));
    if valid {
        Ok(normalised)
    } else {
        Err(AppError::validation(format!(
            "{field}: symbol contains invalid characters"
        )))
    }
}

/// Three-letter currency code, upper-cased (`v.length(3)` + `v.toUpperCase()`).
pub fn currency(field: &str, value: &str) -> AppResult<String> {
    if js_len(value) != 3 {
        return Err(AppError::validation(format!(
            "{field} must be a 3-letter currency code"
        )));
    }
    Ok(value.to_uppercase())
}

/// `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (Valibot `v.hexColor()`).
pub fn hex_color(field: &str, value: &str) -> AppResult<()> {
    let digits = value.strip_prefix('#').unwrap_or("");
    let valid =
        matches!(digits.len(), 3 | 4 | 6 | 8) && digits.bytes().all(|b| b.is_ascii_hexdigit());
    if valid {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field} must be a hex colour"
        )))
    }
}

/// Keys of option and secret maps: `^[a-zA-Z][a-zA-Z0-9]*$`, at most 40 characters.
pub fn map_key(field: &str, key: &str) -> AppResult<()> {
    let mut chars = key.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric())
        && key.len() <= 40;
    if valid {
        Ok(())
    } else {
        Err(AppError::validation(format!(
            "{field}: invalid key \"{key}\""
        )))
    }
}

pub fn rating(field: &str, value: Option<i64>) -> AppResult<()> {
    match value {
        Some(n) if !(1..=5).contains(&n) => Err(AppError::validation(format!(
            "{field} must be between 1 and 5"
        ))),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_and_rejects_uuids() {
        assert!(uuid("id", "0199f0a2-7c1e-7b3a-9d2e-1f2a3b4c5d6e").is_ok());
        assert!(uuid("id", "not-a-uuid").is_err());
        assert!(uuid("id", "0199f0a2x7c1e-7b3a-9d2e-1f2a3b4c5d6e").is_err());
    }

    #[test]
    fn checks_dates_and_timestamps() {
        assert!(date("d", "2026-10-20").is_ok());
        assert!(date("d", "2026-02-30").is_err());
        assert!(date("d", "2026-1-20").is_err());
        assert!(timestamp("t", "2026-10-20T13:30:00.000Z").is_ok());
        assert!(timestamp("t", "2026-10-20T13:30:00+02:00").is_ok());
        assert!(timestamp("t", "2026-10-20 13:30").is_err());
    }

    #[test]
    fn normalises_symbols_and_colours() -> AppResult<()> {
        assert_eq!(symbol("s", " spy ")?, "SPY");
        assert!(symbol("s", "SP Y").is_err());
        assert!(hex_color("c", "#f2c14e").is_ok());
        assert!(hex_color("c", "f2c14e").is_err());
        Ok(())
    }
}
