//! Serde mirrors of the Valibot schemas in `packages/core/src/domain/schemas.ts`.
//!
//! JSON is camelCase and unknown fields are rejected, so a drift between the TypeScript
//! contract and these types fails loudly at the IPC boundary instead of silently losing data.
//! Each `validated` method enforces the same invariants as the schema and returns the
//! normalised value (trimmed names, upper-cased symbols and currencies).

use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::validate as check;

const MAX_TEXT: usize = 20_000;
const MAX_NAME: usize = 120;

pub const ASSET_CLASSES: &[&str] = &["stock", "option", "future", "crypto", "forex"];
pub const LEG_KINDS: &[&str] = &["stock", "call", "put", "future", "crypto", "forex"];
pub const SIDES: &[&str] = &["buy", "sell"];
pub const EXECUTION_KINDS: &[&str] = &["fill", "expiration", "assignment", "exercise"];
pub const LEVEL_KINDS: &[&str] = &["stop", "target"];
pub const TAG_CATEGORIES: &[&str] = &["setup", "mistake", "emotion", "market", "custom"];
pub const NOTE_KINDS: &[&str] = &["premarket", "recap", "lesson", "general"];
pub const THEMES: &[&str] = &["system", "dark", "light"];
pub const PROVIDER_IDS: &[&str] = &["massive", "alpaca", "tiingo", "databento", "simulated"];
pub const STRATEGY_KINDS: &[&str] = &[
    "shares_long",
    "shares_short",
    "long_call",
    "short_call",
    "long_put",
    "short_put",
    "covered_call",
    "protective_put",
    "collar",
    "bull_call_spread",
    "bear_call_spread",
    "bull_put_spread",
    "bear_put_spread",
    "long_straddle",
    "short_straddle",
    "long_strangle",
    "short_strangle",
    "iron_condor",
    "reverse_iron_condor",
    "iron_butterfly",
    "reverse_iron_butterfly",
    "long_call_butterfly",
    "short_call_butterfly",
    "long_put_butterfly",
    "short_put_butterfly",
    "call_calendar",
    "put_calendar",
    "call_diagonal",
    "put_diagonal",
    "ratio_spread",
    "futures_long",
    "futures_short",
    "custom",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub broker: String,
    pub currency: String,
    pub starting_balance: f64,
    pub archived: bool,
    pub created_at: String,
}

impl Account {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Account id", &self.id)?;
        let name = check::name("Name", &self.name, MAX_NAME)?;
        let broker = self.broker.trim().to_owned();
        check::max_len("Broker", &broker, MAX_NAME)?;
        let currency = check::currency("Currency", &self.currency)?;
        check::non_negative("Starting balance", self.starting_balance)?;
        check::timestamp("createdAt", &self.created_at)?;
        Ok(Self {
            name,
            broker,
            currency,
            ..self
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub category: String,
    pub color: String,
}

impl Tag {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Tag id", &self.id)?;
        let name = check::name("Name", &self.name, 60)?;
        check::one_of("Category", &self.category, TAG_CATEGORIES)?;
        check::hex_color("Colour", &self.color)?;
        Ok(Self { name, ..self })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Playbook {
    pub id: String,
    pub name: String,
    pub description: String,
    pub rules: Vec<String>,
    pub color: String,
    pub archived: bool,
    pub created_at: String,
}

impl Playbook {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Playbook id", &self.id)?;
        let name = check::name("Name", &self.name, MAX_NAME)?;
        check::max_len("Description", &self.description, MAX_TEXT)?;
        if self.rules.len() > 50 {
            return Err(AppError::validation("A playbook has at most 50 rules"));
        }
        let rules = self
            .rules
            .iter()
            .map(|rule| check::name("Rule", rule, 400))
            .collect::<AppResult<Vec<_>>>()?;
        check::hex_color("Colour", &self.color)?;
        check::timestamp("createdAt", &self.created_at)?;
        Ok(Self {
            name,
            rules,
            ..self
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Note {
    pub id: String,
    pub date: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Note {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Note id", &self.id)?;
        check::date("Date", &self.date)?;
        let title = self.title.trim().to_owned();
        check::max_len("Title", &title, 200)?;
        check::max_len("Body", &self.body, 100_000)?;
        check::one_of("Kind", &self.kind, NOTE_KINDS)?;
        check::timestamp("createdAt", &self.created_at)?;
        check::timestamp("updatedAt", &self.updated_at)?;
        Ok(Self { title, ..self })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Leg {
    pub id: String,
    pub kind: String,
    pub underlying: String,
    pub strike: Option<f64>,
    pub expiration: Option<String>,
    pub multiplier: f64,
}

impl Leg {
    fn validated(self) -> AppResult<Self> {
        check::uuid("Leg id", &self.id)?;
        check::one_of("Leg kind", &self.kind, LEG_KINDS)?;
        let underlying = check::symbol("Leg underlying", &self.underlying)?;
        if let Some(strike) = self.strike {
            check::positive("Strike", strike)?;
        }
        if let Some(expiration) = &self.expiration {
            check::date("Expiration", expiration)?;
        }
        check::positive("Multiplier", self.multiplier)?;
        let is_option = self.kind == "call" || self.kind == "put";
        let consistent = if is_option {
            self.strike.is_some() && self.expiration.is_some()
        } else {
            self.strike.is_none()
        };
        if !consistent {
            return Err(AppError::validation(
                "Option legs need a strike and an expiration; other legs must not have a strike",
            ));
        }
        Ok(Self { underlying, ..self })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Execution {
    pub id: String,
    pub leg_id: String,
    pub side: String,
    pub kind: String,
    pub quantity: f64,
    pub price: f64,
    pub fees: f64,
    pub executed_at: String,
    pub underlying_price: Option<f64>,
    pub note: String,
}

impl Execution {
    fn validate(&self) -> AppResult<()> {
        check::uuid("Execution id", &self.id)?;
        check::uuid("Execution legId", &self.leg_id)?;
        check::one_of("Side", &self.side, SIDES)?;
        check::one_of("Execution kind", &self.kind, EXECUTION_KINDS)?;
        check::positive("Quantity", self.quantity)?;
        check::non_negative("Price", self.price)?;
        check::non_negative("Fees", self.fees)?;
        check::timestamp("executedAt", &self.executed_at)?;
        if let Some(price) = self.underlying_price {
            check::positive("Underlying price", price)?;
        }
        check::max_len("Execution note", &self.note, MAX_TEXT)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PriceLevel {
    pub id: String,
    pub kind: String,
    pub price: f64,
    pub set_at: String,
    pub note: String,
}

impl PriceLevel {
    fn validate(&self) -> AppResult<()> {
        check::uuid("Level id", &self.id)?;
        check::one_of("Level kind", &self.kind, LEVEL_KINDS)?;
        check::positive("Level price", self.price)?;
        check::timestamp("setAt", &self.set_at)?;
        check::max_len("Level note", &self.note, 1000)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Trade {
    pub id: String,
    pub account_id: String,
    pub underlying: String,
    pub asset_class: String,
    pub strategy: Option<String>,
    pub playbook_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub legs: Vec<Leg>,
    pub executions: Vec<Execution>,
    pub levels: Vec<PriceLevel>,
    pub planned_risk: Option<f64>,
    pub thesis: String,
    pub review: String,
    pub rating: Option<i64>,
    pub confidence: Option<i64>,
    pub mfe: Option<f64>,
    pub mae: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

impl Trade {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Trade id", &self.id)?;
        check::uuid("Account id", &self.account_id)?;
        let underlying = check::symbol("Underlying", &self.underlying)?;
        check::one_of("Asset class", &self.asset_class, ASSET_CLASSES)?;
        if let Some(strategy) = &self.strategy {
            check::one_of("Strategy", strategy, STRATEGY_KINDS)?;
        }
        if let Some(playbook_id) = &self.playbook_id {
            check::uuid("Playbook id", playbook_id)?;
        }
        if self.tag_ids.len() > 64 {
            return Err(AppError::validation("A trade has at most 64 tags"));
        }
        let mut seen_tags = HashSet::new();
        for tag_id in &self.tag_ids {
            check::uuid("Tag id", tag_id)?;
            if !seen_tags.insert(tag_id.as_str()) {
                return Err(AppError::validation("A tag is listed twice on the trade"));
            }
        }
        if self.legs.is_empty() {
            return Err(AppError::validation("A trade needs at least one leg"));
        }
        if self.legs.len() > 16 {
            return Err(AppError::validation("A trade has at most 16 legs"));
        }
        if self.executions.len() > 2000 {
            return Err(AppError::validation("A trade has at most 2000 executions"));
        }
        if self.levels.len() > 500 {
            return Err(AppError::validation("A trade has at most 500 price levels"));
        }
        let legs = self
            .legs
            .into_iter()
            .map(Leg::validated)
            .collect::<AppResult<Vec<_>>>()?;
        let mut leg_ids = HashSet::new();
        for leg in &legs {
            if leg.underlying != underlying {
                return Err(AppError::validation(
                    "Every leg must be on the trade underlying",
                ));
            }
            if !leg_ids.insert(leg.id.as_str()) {
                return Err(AppError::validation("Two legs share the same id"));
            }
        }
        let mut execution_ids = HashSet::new();
        for execution in &self.executions {
            execution.validate()?;
            if !leg_ids.contains(execution.leg_id.as_str()) {
                return Err(AppError::validation(
                    "Every execution must reference a leg of the same trade",
                ));
            }
            if !execution_ids.insert(execution.id.as_str()) {
                return Err(AppError::validation("Two executions share the same id"));
            }
        }
        let mut level_ids = HashSet::new();
        for level in &self.levels {
            level.validate()?;
            if !level_ids.insert(level.id.as_str()) {
                return Err(AppError::validation("Two price levels share the same id"));
            }
        }
        if let Some(risk) = self.planned_risk {
            check::positive("Planned risk", risk)?;
        }
        check::max_len("Thesis", &self.thesis, MAX_TEXT)?;
        check::max_len("Review", &self.review, MAX_TEXT)?;
        check::rating("Rating", self.rating)?;
        check::rating("Confidence", self.confidence)?;
        if let Some(mfe) = self.mfe {
            check::finite("MFE", mfe)?;
        }
        if let Some(mae) = self.mae {
            check::finite("MAE", mae)?;
        }
        check::timestamp("createdAt", &self.created_at)?;
        check::timestamp("updatedAt", &self.updated_at)?;
        Ok(Self {
            underlying,
            legs,
            ..self
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UserSettings {
    pub display_name: String,
    pub time_zone: String,
    pub base_currency: String,
    pub breakeven_threshold: f64,
    pub default_commission_per_contract: f64,
    pub default_commission_per_share: f64,
    pub risk_free_rate: f64,
    pub theme: String,
    pub week_starts_on: u8,
}

impl Default for UserSettings {
    /// Mirrors `DEFAULT_SETTINGS` in `@strikebook/core`.
    fn default() -> Self {
        Self {
            display_name: String::new(),
            time_zone: "America/New_York".to_owned(),
            base_currency: "USD".to_owned(),
            breakeven_threshold: 1.0,
            default_commission_per_contract: 0.65,
            default_commission_per_share: 0.0,
            risk_free_rate: 0.04,
            theme: "system".to_owned(),
            week_starts_on: 1,
        }
    }
}

impl UserSettings {
    pub fn validated(self) -> AppResult<Self> {
        let display_name = self.display_name.trim().to_owned();
        check::max_len("Display name", &display_name, MAX_NAME)?;
        // IANA zone names: letters, digits and `/_+-`. The webview checks the zone exists via Intl.
        let zone_ok = !self.time_zone.is_empty()
            && self.time_zone.len() <= 64
            && self
                .time_zone
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "/_+-".contains(c));
        if !zone_ok {
            return Err(AppError::validation("Unknown time zone"));
        }
        let base_currency = check::currency("Base currency", &self.base_currency)?;
        check::non_negative("Breakeven threshold", self.breakeven_threshold)?;
        check::non_negative(
            "Commission per contract",
            self.default_commission_per_contract,
        )?;
        check::non_negative("Commission per share", self.default_commission_per_share)?;
        check::finite("Risk-free rate", self.risk_free_rate)?;
        if !(-0.05..=0.25).contains(&self.risk_free_rate) {
            return Err(AppError::validation(
                "Risk-free rate must be between -0.05 and 0.25",
            ));
        }
        check::one_of("Theme", &self.theme, THEMES)?;
        if self.week_starts_on > 1 {
            return Err(AppError::validation(
                "Week must start on Sunday (0) or Monday (1)",
            ));
        }
        Ok(Self {
            display_name,
            base_currency,
            ..self
        })
    }
}

/// What the webview may see about a configured provider — never the secret.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderConfigView {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub options: BTreeMap<String, String>,
    pub is_default: bool,
    pub secret_hint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub type ProviderSecret = HashMap<String, String>;

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderConfigInput {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub options: BTreeMap<String, String>,
    pub is_default: bool,
    /// `None` keeps the stored secret unchanged.
    pub secret: Option<ProviderSecret>,
}

impl ProviderConfigInput {
    pub fn validated(self) -> AppResult<Self> {
        check::uuid("Provider id", &self.id)?;
        check::one_of("Provider", &self.provider, PROVIDER_IDS)?;
        let label = check::name("Label", &self.label, MAX_NAME)?;
        for (key, value) in &self.options {
            check::map_key("Option", key)?;
            check::max_len("Option value", value, 200)?;
        }
        let secret = match self.secret {
            None => None,
            Some(map) => {
                let mut trimmed = ProviderSecret::with_capacity(map.len());
                for (key, value) in map {
                    check::map_key("Secret field", &key)?;
                    let value = check::name("Secret value", &value, 512)?;
                    trimmed.insert(key, value);
                }
                Some(trimmed)
            }
        };
        Ok(Self {
            label,
            secret,
            ..self
        })
    }
}

/// OHLCV bar; `time` is the bar's open in UTC seconds.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bar {
    pub time: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl Bar {
    pub fn validate(&self) -> AppResult<()> {
        let all_finite = [
            self.time,
            self.open,
            self.high,
            self.low,
            self.close,
            self.volume,
        ]
        .iter()
        .all(|x| x.is_finite());
        if all_finite {
            Ok(())
        } else {
            Err(AppError::validation("Bars must contain finite numbers"))
        }
    }
}

/// Mirrors `BarsCacheKey` in `@strikebook/core/market-data`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BarsCacheKey {
    /// Provider configuration id.
    pub provider: String,
    pub instrument: String,
    pub timeframe: String,
}

pub const TIMEFRAMES: &[(&str, i64)] = &[
    ("1m", 60),
    ("5m", 300),
    ("15m", 900),
    ("30m", 1800),
    ("1h", 3600),
    ("4h", 14_400),
    ("1D", 86_400),
    ("1W", 604_800),
];

impl BarsCacheKey {
    /// Validates the key and returns the timeframe's bar length in milliseconds.
    pub fn validated_bar_ms(&self) -> AppResult<i64> {
        check::uuid("Provider id", &self.provider)?;
        if self.instrument.trim().is_empty() || self.instrument.len() > 64 {
            return Err(AppError::validation("Invalid instrument key"));
        }
        TIMEFRAMES
            .iter()
            .find(|(name, _)| *name == self.timeframe)
            .map(|(_, seconds)| seconds * 1000)
            .ok_or_else(|| {
                AppError::validation(format!("Unknown timeframe \"{}\"", self.timeframe))
            })
    }
}

pub const EXPORT_FORMAT: &str = "strikebook.journal";
pub const EXPORT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JournalExport {
    pub format: String,
    pub version: u32,
    pub exported_at: String,
    pub settings: UserSettings,
    pub accounts: Vec<Account>,
    pub tags: Vec<Tag>,
    pub playbooks: Vec<Playbook>,
    pub notes: Vec<Note>,
    pub trades: Vec<Trade>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ImportSummary {
    pub trades: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_fields() {
        let json = serde_json::json!({
            "id": "0199f0a2-7c1e-7b3a-9d2e-1f2a3b4c5d6e",
            "name": "Swing",
            "category": "setup",
            "color": "#f2c14e",
            "extra": true
        });
        assert!(serde_json::from_value::<Tag>(json).is_err());
    }

    #[test]
    fn settings_default_matches_core() -> Result<(), serde_json::Error> {
        let json = serde_json::to_value(UserSettings::default())?;
        assert_eq!(
            json,
            serde_json::json!({
                "displayName": "",
                "timeZone": "America/New_York",
                "baseCurrency": "USD",
                "breakevenThreshold": 1.0,
                "defaultCommissionPerContract": 0.65,
                "defaultCommissionPerShare": 0.0,
                "riskFreeRate": 0.04,
                "theme": "system",
                "weekStartsOn": 1
            })
        );
        Ok(())
    }
}
