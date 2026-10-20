use anyhow::{bail, Context, Result};
use uuid::Uuid;

use crate::{
    db::DbManager,
    models::{
        AnalyticsProgressResponse, CorpusPassage, DrillSession, DriftEvent, EvaluationResult,
        SessionDebriefDetail, SessionDetailResponse, SessionIntentDetail,
    },
};

pub const VALID_DRILL_TYPES: &[&str] = &[
    "sequential_pipeline",
    "index_card_pacer",
    "one_breath_recall",
    "preflight_intent",
    "three_sentence_debrief",
    "deliberate_slowdown",
];

pub const VALID_STAGES: &[&str] = &[
    "preflight_intent",
    "active_reading",
    "intent_recall",
    "paragraph_recap",
    "debrief",
    "completed",
    "aborted",
];

/// Validates whether a drill type string is known
pub fn is_valid_drill_type(drill_type: &str) -> bool {
    VALID_DRILL_TYPES.contains(&drill_type)
}

/// Validates whether a session stage string is valid
pub fn is_valid_stage(stage: &str) -> bool {
    VALID_STAGES.contains(&stage)
}

/// Determines the standard sequential next stage in the pipeline
pub fn get_default_next_stage(current: &str, drill_type: &str) -> Option<&'static str> {
    match drill_type {
        "sequential_pipeline" => match current {
            "preflight_intent" => Some("active_reading"),
            "active_reading" => Some("intent_recall"),
            "intent_recall" => Some("debrief"),
            "debrief" => Some("completed"),
            _ => None,
        },
        "one_breath_recall" => match current {
            "preflight_intent" => Some("active_reading"),
            "active_reading" => Some("paragraph_recap"),
            "paragraph_recap" => Some("debrief"),
            "debrief" => Some("completed"),
            _ => None,
        },
        "index_card_pacer" | "deliberate_slowdown" => match current {
            "preflight_intent" => Some("active_reading"),
            "active_reading" => Some("completed"),
            _ => None,
        },
        "preflight_intent" => match current {
            "preflight_intent" => Some("completed"),
            _ => None,
        },
        "three_sentence_debrief" => match current {
            "debrief" => Some("completed"),
            _ => None,
        },
        _ => None,
    }
}

/// Checks whether a transition between two stages is allowable
pub fn is_valid_transition(current: &str, target: &str) -> bool {
    if current == "completed" || current == "aborted" {
        return false;
    }
    if target == "aborted" {
        return true;
    }
    matches!(
        (current, target),
        ("preflight_intent", "active_reading")
            | ("preflight_intent", "completed")
            | ("active_reading", "intent_recall")
            | ("active_reading", "paragraph_recap")
            | ("active_reading", "debrief")
            | ("active_reading", "completed")
            | ("intent_recall", "debrief")
            | ("intent_recall", "completed")
            | ("paragraph_recap", "debrief")
            | ("paragraph_recap", "completed")
            | ("debrief", "completed")
    )
}

/// Calculates Words Per Minute (WPM)
pub fn calculate_wpm(word_count: i64, duration_seconds: i64) -> f64 {
    if duration_seconds <= 0 || word_count <= 0 {
        return 0.0;
    }
    let wpm = (word_count as f64 / duration_seconds as f64) * 60.0;
    (wpm * 10.0).round() / 10.0
}

/// Calculates Mean Time Between Drifts (MTBD)
pub fn calculate_mtbd(duration_seconds: i64, drift_count: i64) -> f64 {
    if duration_seconds <= 0 {
        return 0.0;
    }
    if drift_count <= 0 {
        return duration_seconds as f64;
    }
    let mtbd = duration_seconds as f64 / drift_count as f64;
    (mtbd * 10.0).round() / 10.0
}

fn row_to_session(row: &libsql::Row) -> Result<DrillSession, libsql::Error> {
    Ok(DrillSession {
        id: row.get(0)?,
        corpus_id: row.get(1)?,
        drill_type: row.get(2)?,
        current_stage: row.get(3)?,
        started_at: row.get(4)?,
        ended_at: row.get(5)?,
        duration_seconds: row.get(6)?,
        words_per_minute: row.get(7)?,
        drift_count: row.get(8)?,
        status: row.get(9)?,
    })
}

/// Initializes a new drill session
pub async fn start_session(
    db: &DbManager,
    corpus_id: &str,
    drill_type: Option<&str>,
) -> Result<DrillSession> {
    let drill_type = drill_type.unwrap_or("sequential_pipeline");
    if !is_valid_drill_type(drill_type) {
        bail!("Invalid drill_type '{drill_type}'");
    }

    let conn = db.connect().context("Failed to obtain DB connection")?;

    // Verify corpus_id exists
    let mut corpus_row = conn
        .query("SELECT id FROM reading_corpus WHERE id = ?1", [corpus_id])
        .await
        .context("Corpus query failed")?;

    if corpus_row.next().await?.is_none() {
        bail!("Corpus passage '{corpus_id}' not found");
    }

    let session_id = format!("sess_{}", Uuid::new_v4().simple());
    let initial_stage = if drill_type == "three_sentence_debrief" {
        "debrief"
    } else {
        "preflight_intent"
    };

    conn.execute(
        "INSERT INTO drill_sessions (id, corpus_id, drill_type, current_stage, status)
         VALUES (?1, ?2, ?3, ?4, 'in_progress')",
        libsql::params![
            session_id.clone(),
            corpus_id.to_string(),
            drill_type.to_string(),
            initial_stage
        ],
    )
    .await
    .context("Failed to create drill session")?;

    get_session_by_id(db, &session_id).await
}

/// Retrieves a drill session by ID
pub async fn get_session_by_id(db: &DbManager, session_id: &str) -> Result<DrillSession> {
    let conn = db.connect()?;
    let mut rows = conn
        .query(
            "SELECT id, corpus_id, drill_type, current_stage, started_at, ended_at, duration_seconds, words_per_minute, drift_count, status
             FROM drill_sessions WHERE id = ?1",
            [session_id],
        )
        .await?;

    match rows.next().await? {
        Some(row) => Ok(row_to_session(&row)?),
        None => bail!("Session '{session_id}' not found"),
    }
}

/// Records a timestamped drift event for an active session
pub async fn record_drift_event(
    db: &DbManager,
    session_id: &str,
    elapsed_seconds: f64,
    line_number: Option<i64>,
) -> Result<DriftEvent> {
    let conn = db.connect()?;

    // Check session status
    let session = get_session_by_id(db, session_id).await?;
    if session.status != "in_progress" {
        bail!("Cannot record drift: session status is '{}'", session.status);
    }

    // Rate-limiting check: reject drift event if last drift was within 0.15s
    let mut last_event_rows = conn
        .query(
            "SELECT elapsed_seconds FROM drift_events WHERE session_id = ?1 ORDER BY elapsed_seconds DESC LIMIT 1",
            [session_id],
        )
        .await?;

    if let Some(row) = last_event_rows.next().await? {
        let last_elapsed: f64 = row.get(0)?;
        if (elapsed_seconds - last_elapsed).abs() < 0.15 {
            bail!("Drift event debounced: elapsed time too close to previous drift");
        }
    }

    let drift_id = format!("drift_{}", Uuid::new_v4().simple());
    conn.execute(
        "INSERT INTO drift_events (id, session_id, elapsed_seconds, line_number)
         VALUES (?1, ?2, ?3, ?4)",
        libsql::params![
            drift_id.clone(),
            session_id.to_string(),
            elapsed_seconds,
            line_number
        ],
    )
    .await?;

    // Increment drift_count on session
    conn.execute(
        "UPDATE drill_sessions SET drift_count = drift_count + 1 WHERE id = ?1",
        [session_id],
    )
    .await?;

    Ok(DriftEvent {
        id: drift_id,
        session_id: session_id.to_string(),
        elapsed_seconds,
        line_number,
        created_at: None,
    })
}

/// Finalizes the active reading phase and computes WPM
pub async fn finish_reading_phase(
    db: &DbManager,
    session_id: &str,
    duration_seconds: i64,
) -> Result<DrillSession> {
    if duration_seconds < 0 {
        bail!("Duration cannot be negative");
    }

    let conn = db.connect()?;
    let session = get_session_by_id(db, session_id).await?;

    // Look up word count of corpus passage
    let mut corpus_rows = conn
        .query(
            "SELECT word_count FROM reading_corpus WHERE id = ?1",
            [session.corpus_id.as_str()],
        )
        .await?;

    let word_count: i64 = match corpus_rows.next().await? {
        Some(row) => row.get(0)?,
        None => 0,
    };

    let wpm = calculate_wpm(word_count, duration_seconds);

    conn.execute(
        "UPDATE drill_sessions
         SET duration_seconds = ?1, words_per_minute = ?2
         WHERE id = ?3",
        libsql::params![duration_seconds, wpm, session_id],
    )
    .await?;

    get_session_by_id(db, session_id).await
}

/// Advances session to next stage
pub async fn advance_session_stage(
    db: &DbManager,
    session_id: &str,
    requested_stage: Option<&str>,
) -> Result<DrillSession> {
    let session = get_session_by_id(db, session_id).await?;

    let next_stage = match requested_stage {
        Some(target) => {
            if !is_valid_stage(target) {
                bail!("Invalid stage '{target}'");
            }
            if !is_valid_transition(&session.current_stage, target) {
                bail!(
                    "Invalid transition from '{}' to '{}'",
                    session.current_stage,
                    target
                );
            }
            target.to_string()
        }
        None => match get_default_next_stage(&session.current_stage, &session.drill_type) {
            Some(stage) => stage.to_string(),
            None => bail!(
                "No default progression from '{}' for drill '{}'",
                session.current_stage,
                session.drill_type
            ),
        },
    };

    let new_status = if next_stage == "completed" {
        "completed"
    } else {
        session.status.as_str()
    };

    let conn = db.connect()?;
    if next_stage == "completed" {
        conn.execute(
            "UPDATE drill_sessions
             SET current_stage = ?1, status = ?2, ended_at = CURRENT_TIMESTAMP
             WHERE id = ?3",
            libsql::params![next_stage, new_status, session_id],
        )
        .await?;
    } else {
        conn.execute(
            "UPDATE drill_sessions
             SET current_stage = ?1, status = ?2
             WHERE id = ?3",
            libsql::params![next_stage, new_status, session_id],
        )
        .await?;
    }

    get_session_by_id(db, session_id).await
}

/// Aborts an active session
pub async fn abort_session(db: &DbManager, session_id: &str) -> Result<DrillSession> {
    let session = get_session_by_id(db, session_id).await?;
    if session.status == "completed" {
        bail!("Cannot abort a completed session");
    }

    let conn = db.connect()?;
    conn.execute(
        "UPDATE drill_sessions
         SET status = 'aborted', current_stage = 'aborted', ended_at = CURRENT_TIMESTAMP
         WHERE id = ?1",
        [session_id],
    )
    .await?;

    get_session_by_id(db, session_id).await
}

/// Fetches full session details including passage and drift events
pub async fn get_session_details(db: &DbManager, session_id: &str) -> Result<SessionDetailResponse> {
    let session = get_session_by_id(db, session_id).await?;
    let conn = db.connect()?;

    // Fetch passage
    let mut passage_rows = conn
        .query(
            "SELECT id, title, domain, source_attribution, passage_text, word_count, lexical_density_score, created_at
             FROM reading_corpus WHERE id = ?1",
            [session.corpus_id.as_str()],
        )
        .await?;

    let passage = match passage_rows.next().await? {
        Some(row) => CorpusPassage {
            id: row.get(0)?,
            title: row.get(1)?,
            domain: row.get(2)?,
            source_attribution: row.get(3)?,
            passage_text: row.get(4)?,
            word_count: row.get(5)?,
            lexical_density_score: row.get(6)?,
            created_at: row.get(7)?,
        },
        None => bail!("Associated passage '{}' not found", session.corpus_id),
    };

    // Fetch drift events
    let mut drift_rows = conn
        .query(
            "SELECT id, session_id, elapsed_seconds, line_number, created_at
             FROM drift_events WHERE session_id = ?1 ORDER BY elapsed_seconds ASC",
            [session_id],
        )
        .await?;

    let mut drift_events = Vec::new();
    while let Some(row) = drift_rows.next().await? {
        drift_events.push(DriftEvent {
            id: row.get(0)?,
            session_id: row.get(1)?,
            elapsed_seconds: row.get(2)?,
            line_number: row.get(3)?,
            created_at: row.get(4)?,
        });
    }

    let mtbd = calculate_mtbd(session.duration_seconds, session.drift_count);

    // Fetch intent if submitted
    let mut intent_rows = conn
        .query(
            "SELECT id, session_id, focus_lens, target_question, user_synthesis, response_latency_seconds, created_at
             FROM session_intents WHERE session_id = ?1",
            [session_id],
        )
        .await?;

    let intent = match intent_rows.next().await? {
        Some(row) => Some(SessionIntentDetail {
            id: row.get(0)?,
            session_id: row.get(1)?,
            focus_lens: row.get(2)?,
            target_question: row.get(3)?,
            user_synthesis: row.get(4)?,
            response_latency_seconds: row.get(5)?,
            created_at: row.get(6)?,
        }),
        None => None,
    };

    // Fetch debrief if submitted
    let mut debrief_rows = conn
        .query(
            "SELECT id, session_id, core_premise, pivot_or_surprise, implication, created_at
             FROM session_debriefs WHERE session_id = ?1",
            [session_id],
        )
        .await?;

    let debrief = match debrief_rows.next().await? {
        Some(row) => Some(SessionDebriefDetail {
            id: row.get(0)?,
            session_id: row.get(1)?,
            core_premise: row.get(2)?,
            pivot_or_surprise: row.get(3)?,
            implication: row.get(4)?,
            created_at: row.get(5)?,
        }),
        None => None,
    };

    // Fetch evaluations
    let mut eval_rows = conn
        .query(
            "SELECT id, session_id, target_type, target_id, evaluation_status, clarity_score, conciseness_score, insight_score, composite_score, constructive_feedback, evaluator_model, inference_duration_ms, created_at
             FROM evaluations WHERE session_id = ?1 ORDER BY created_at ASC",
            [session_id],
        )
        .await?;

    let mut evaluations = Vec::new();
    while let Some(row) = eval_rows.next().await? {
        evaluations.push(EvaluationResult {
            id: row.get(0)?,
            session_id: row.get(1)?,
            target_type: row.get(2)?,
            target_id: row.get(3)?,
            evaluation_status: row.get(4)?,
            clarity_score: row.get(5)?,
            conciseness_score: row.get(6)?,
            insight_score: row.get(7)?,
            composite_score: row.get(8)?,
            constructive_feedback: row.get(9)?,
            evaluator_model: row.get(10)?,
            inference_duration_ms: row.get(11)?,
            created_at: row.get(12)?,
        });
    }

    Ok(SessionDetailResponse {
        session,
        passage,
        drift_events,
        mean_time_between_drifts: mtbd,
        intent,
        debrief,
        evaluations,
    })
}

/// Stores or updates user's pre-flight intent answer
pub async fn save_session_intent(
    db: &DbManager,
    session_id: &str,
    focus_lens: &str,
    target_question: &str,
    user_synthesis: &str,
    response_latency_seconds: Option<i64>,
) -> Result<SessionIntentDetail> {
    let conn = db.connect()?;
    let intent_id = format!("intent_{}", Uuid::new_v4().simple());

    conn.execute(
        "INSERT INTO session_intents (id, session_id, focus_lens, target_question, user_synthesis, response_latency_seconds)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        libsql::params![
            intent_id.clone(),
            session_id.to_string(),
            focus_lens.to_string(),
            target_question.to_string(),
            user_synthesis.to_string(),
            response_latency_seconds
        ],
    )
    .await?;

    Ok(SessionIntentDetail {
        id: intent_id,
        session_id: session_id.to_string(),
        focus_lens: focus_lens.to_string(),
        target_question: target_question.to_string(),
        user_synthesis: Some(user_synthesis.to_string()),
        response_latency_seconds,
        created_at: None,
    })
}

/// Stores user's 3-sentence debrief
pub async fn save_session_debrief(
    db: &DbManager,
    session_id: &str,
    core_premise: &str,
    pivot_or_surprise: &str,
    implication: &str,
) -> Result<SessionDebriefDetail> {
    let conn = db.connect()?;
    let debrief_id = format!("debrief_{}", Uuid::new_v4().simple());

    conn.execute(
        "INSERT INTO session_debriefs (id, session_id, core_premise, pivot_or_surprise, implication)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        libsql::params![
            debrief_id.clone(),
            session_id.to_string(),
            core_premise.to_string(),
            pivot_or_surprise.to_string(),
            implication.to_string()
        ],
    )
    .await?;

    Ok(SessionDebriefDetail {
        id: debrief_id,
        session_id: session_id.to_string(),
        core_premise: core_premise.to_string(),
        pivot_or_surprise: pivot_or_surprise.to_string(),
        implication: implication.to_string(),
        created_at: None,
    })
}

/// Generates rolling analytics and progress summary
pub async fn get_analytics_progress(db: &DbManager) -> Result<AnalyticsProgressResponse> {
    let conn = db.connect()?;

    // Fetch recent completed sessions
    let mut session_rows = conn
        .query(
            "SELECT id, corpus_id, drill_type, current_stage, started_at, ended_at, duration_seconds, words_per_minute, drift_count, status
             FROM drill_sessions ORDER BY started_at DESC LIMIT 50",
            (),
        )
        .await?;

    let mut sessions = Vec::new();
    let mut total_wpm = 0.0;
    let mut total_mtbd = 0.0;
    let mut completed_count = 0;
    let mut total_drifts = 0;

    while let Some(row) = session_rows.next().await? {
        let s = row_to_session(&row)?;
        if s.status == "completed" {
            completed_count += 1;
            total_wpm += s.words_per_minute;
            total_mtbd += calculate_mtbd(s.duration_seconds, s.drift_count);
        }
        total_drifts += s.drift_count;
        sessions.push(s);
    }

    let total_sessions = sessions.len();
    let average_wpm = if completed_count > 0 {
        ((total_wpm / completed_count as f64) * 10.0).round() / 10.0
    } else {
        0.0
    };

    let average_mtbd = if completed_count > 0 {
        ((total_mtbd / completed_count as f64) * 10.0).round() / 10.0
    } else {
        0.0
    };

    Ok(AnalyticsProgressResponse {
        total_sessions,
        completed_sessions: completed_count,
        average_wpm,
        average_mtbd,
        total_drift_events: total_drifts,
        recent_sessions: sessions,
    })
}
