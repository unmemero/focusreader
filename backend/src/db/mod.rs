use anyhow::{Context, Result};
use libsql::{Builder, Connection, Database};
use std::path::Path;
use std::sync::Arc;
use tracing::info;
use uuid::Uuid;

pub const MIGRATIONS_SQL: &str = r#"
-- Application configuration (llama.cpp connection & user preferences)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catalog of free, non-generated source texts
CREATE TABLE IF NOT EXISTS reading_corpus (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL CHECK(length(trim(domain)) > 0),
    source_attribution TEXT NOT NULL,
    passage_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    lexical_density_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Active and historical user drill sessions
CREATE TABLE IF NOT EXISTS drill_sessions (
    id TEXT PRIMARY KEY,
    corpus_id TEXT NOT NULL REFERENCES reading_corpus(id) ON DELETE RESTRICT,
    drill_type TEXT CHECK(drill_type IN (
        'sequential_pipeline',
        'index_card_pacer',
        'one_breath_recall',
        'preflight_intent',
        'three_sentence_debrief',
        'deliberate_slowdown'
    )) NOT NULL,
    current_stage TEXT CHECK(current_stage IN (
        'preflight_intent',
        'active_reading',
        'intent_recall',
        'paragraph_recap',
        'debrief',
        'completed',
        'aborted'
    )) DEFAULT 'preflight_intent',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    words_per_minute REAL DEFAULT 0.0,
    drift_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('in_progress', 'evaluating', 'completed', 'aborted')) DEFAULT 'in_progress'
);

-- Timestamped drift telemetry events during active reading
CREATE TABLE IF NOT EXISTS drift_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
    elapsed_seconds REAL NOT NULL,
    line_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-flight focus questions and post-reading intent synthesis
CREATE TABLE IF NOT EXISTS session_intents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
    focus_lens TEXT CHECK(focus_lens IN ('bottleneck_tradeoff', 'mechanism_invariant', 'core_claim', 'custom')) NOT NULL,
    target_question TEXT NOT NULL,
    user_synthesis TEXT,
    response_latency_seconds INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paragraph-level micro recaps
CREATE TABLE IF NOT EXISTS micro_recaps (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
    paragraph_index INTEGER NOT NULL,
    recap_text TEXT NOT NULL,
    response_latency_seconds INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3-Sentence Debrief synthesis
CREATE TABLE IF NOT EXISTS session_debriefs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
    core_premise TEXT NOT NULL,
    pivot_or_surprise TEXT NOT NULL,
    implication TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Semantic evaluations produced via Gemma / llama.cpp or flagged as offline
CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES drill_sessions(id) ON DELETE CASCADE,
    target_type TEXT CHECK(target_type IN ('intent_answer', 'micro_recap', 'three_sentence')) NOT NULL,
    target_id TEXT NOT NULL,
    evaluation_status TEXT CHECK(evaluation_status IN ('completed', 'offline_skipped', 'failed', 'pending')) DEFAULT 'completed',
    clarity_score REAL CHECK(clarity_score BETWEEN 0.0 AND 1.0),
    conciseness_score REAL CHECK(conciseness_score BETWEEN 0.0 AND 1.0),
    insight_score REAL CHECK(insight_score BETWEEN 0.0 AND 1.0),
    composite_score REAL CHECK(composite_score BETWEEN 0.0 AND 1.0),
    constructive_feedback TEXT,
    evaluator_model TEXT,
    inference_duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_corpus ON drill_sessions(corpus_id);
CREATE INDEX IF NOT EXISTS idx_drift_session ON drift_events(session_id);
CREATE INDEX IF NOT EXISTS idx_evals_session ON evaluations(session_id);
"#;

#[derive(Clone)]
pub struct DbManager {
    db: Arc<Database>,
    _keepalive: Arc<Connection>,
}

impl DbManager {
    /// Initialize a database from a file path or in-memory
    pub async fn init(database_url: &str) -> Result<Self> {
        let db = if database_url == ":memory:" || database_url.is_empty() {
            let unique_mem_uri = format!("file:mem_{}?mode=memory&cache=shared", Uuid::new_v4().simple());
            Builder::new_local(&unique_mem_uri)
                .build()
                .await
                .context("Failed to build in-memory LibreSQL database")?
        } else {
            // Ensure parent directory exists for file path
            let fs_path = database_url.strip_prefix("file:").unwrap_or(database_url);
            // Ignore query parameters if present (e.g. ?cache=shared)
            let clean_fs_path = fs_path.split('?').next().unwrap_or(fs_path);
            if let Some(parent) = Path::new(clean_fs_path).parent().filter(|p| !p.as_os_str().is_empty() && !p.exists()) {
                tokio::fs::create_dir_all(parent)
                    .await
                    .context("Failed to create database parent directory")?;
            }

            Builder::new_local(database_url)
                .build()
                .await
                .context("Failed to build local file LibreSQL database")?
        };

        // Keep at least one connection alive so shared in-memory DB is preserved across connects
        let keepalive = db.connect().context("Failed to open keepalive connection")?;

        let manager = Self {
            db: Arc::new(db),
            _keepalive: Arc::new(keepalive),
        };
        manager.run_migrations().await?;
        Ok(manager)
    }

    /// Connect to the underlying LibreSQL database
    pub fn connect(&self) -> Result<Connection> {
        self.db.connect().context("Failed to obtain database connection")
    }

    /// Execute the database schema migrations
    pub async fn run_migrations(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.execute_batch(MIGRATIONS_SQL)
            .await
            .context("Failed to execute database schema migrations")?;

        // Upgrade legacy reading_corpus tables that had the hardcoded 5-domain CHECK constraint
        let needs_upgrade = {
            let mut rows = conn
                .query(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='reading_corpus'",
                    (),
                )
                .await?;
            if let Some(row) = rows.next().await? {
                row.get::<String>(0)
                    .map(|sql| sql.contains("CHECK(domain IN"))
                    .unwrap_or(false)
            } else {
                false
            }
        };

        if needs_upgrade {
            conn.execute_batch(
                r#"
                PRAGMA foreign_keys = OFF;
                BEGIN TRANSACTION;
                CREATE TABLE IF NOT EXISTS reading_corpus_new (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    domain TEXT NOT NULL CHECK(length(trim(domain)) > 0),
                    source_attribution TEXT NOT NULL,
                    passage_text TEXT NOT NULL,
                    word_count INTEGER NOT NULL,
                    lexical_density_score REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                INSERT OR REPLACE INTO reading_corpus_new (id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at)
                SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at FROM reading_corpus;
                DROP TABLE reading_corpus;
                ALTER TABLE reading_corpus_new RENAME TO reading_corpus;
                COMMIT;
                PRAGMA foreign_keys = ON;
                "#,
            )
            .await
            .context("Failed to upgrade reading_corpus table for custom topics")?;
        }

        info!("Database migrations executed successfully");
        Ok(())
    }
}
