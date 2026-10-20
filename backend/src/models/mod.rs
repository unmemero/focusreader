use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
    pub database: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CorpusPassage {
    pub id: String,
    pub title: String,
    pub domain: String,
    pub source_attribution: String,
    pub passage_text: String,
    pub word_count: i64,
    pub lexical_density_score: Option<f64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestRequest {
    pub title: String,
    pub domain: String,
    pub source_attribution: String,
    pub text: String,
    #[serde(default)]
    pub difficulty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestResponse {
    pub message: String,
    pub passages_created: usize,
    pub passages: Vec<CorpusPassage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SuggestPassageRequest {
    pub domain: Option<String>,
    pub difficulty: Option<String>,
    #[serde(default, alias = "topic_hint")]
    pub prompt_parameters: Option<String>,
    #[serde(default)]
    pub exclude_titles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestPassageResponse {
    pub doc_id: String,
    pub title: String,
    pub domain: String,
    pub difficulty: String,
    #[serde(default)]
    pub classified_topics: Vec<String>,
    pub source_attribution: String,
    pub text: String,
    pub word_count: usize,
    pub selected_sections: String,
    pub total_sections: usize,
    pub selection_reason: String,
    #[serde(default)]
    pub extraction_method: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DrillSession {
    pub id: String,
    pub corpus_id: String,
    pub drill_type: String,
    pub current_stage: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub duration_seconds: i64,
    pub words_per_minute: f64,
    pub drift_count: i64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriftEvent {
    pub id: String,
    pub session_id: String,
    pub elapsed_seconds: f64,
    pub line_number: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionRequest {
    pub corpus_id: String,
    pub drill_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordDriftRequest {
    pub elapsed_seconds: f64,
    pub line_number: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinishReadingRequest {
    pub duration_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvanceStageRequest {
    pub next_stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionIntentDetail {
    pub id: String,
    pub session_id: String,
    pub focus_lens: String,
    pub target_question: String,
    pub user_synthesis: Option<String>,
    pub response_latency_seconds: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionDebriefDetail {
    pub id: String,
    pub session_id: String,
    pub core_premise: String,
    pub pivot_or_surprise: String,
    pub implication: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationResult {
    pub id: String,
    pub session_id: String,
    pub target_type: String,
    pub target_id: String,
    pub evaluation_status: String,
    pub clarity_score: Option<f64>,
    pub conciseness_score: Option<f64>,
    pub insight_score: Option<f64>,
    pub composite_score: Option<f64>,
    pub constructive_feedback: Option<String>,
    pub evaluator_model: Option<String>,
    pub inference_duration_ms: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDetailResponse {
    pub session: DrillSession,
    pub passage: CorpusPassage,
    pub drift_events: Vec<DriftEvent>,
    pub mean_time_between_drifts: f64,
    pub intent: Option<SessionIntentDetail>,
    pub debrief: Option<SessionDebriefDetail>,
    pub evaluations: Vec<EvaluationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsProgressResponse {
    pub total_sessions: usize,
    pub completed_sessions: usize,
    pub average_wpm: f64,
    pub average_mtbd: f64,
    pub total_drift_events: i64,
    pub recent_sessions: Vec<DrillSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigResponse {
    pub llm_base_url: String,
    pub llm_model: String,
    pub llm_timeout_seconds: u64,
    pub is_llm_connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfigRequest {
    pub llm_base_url: Option<String>,
    pub llm_model: Option<String>,
    pub llm_timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestIntentRequest {
    pub lens: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestIntentResponse {
    pub lens: String,
    pub suggested_question: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitIntentRequest {
    pub focus_lens: String,
    pub target_question: String,
    pub user_synthesis: String,
    pub response_latency_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitDebriefRequest {
    pub core_premise: String,
    pub pivot_or_surprise: String,
    pub implication: String,
}
