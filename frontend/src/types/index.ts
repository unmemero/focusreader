export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  database: string;
}

export interface CorpusPassage {
  id: string;
  title: string;
  domain: string;
  source_attribution: string;
  passage_text: string;
  word_count: number;
  lexical_density_score: number | null;
  created_at?: string;
}

export interface IngestRequest {
  title: string;
  domain: string;
  source_attribution: string;
  text: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface IngestResponse {
  message: string;
  passages_created: number;
  passages: CorpusPassage[];
}

export interface SuggestPassageRequest {
  domain?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  prompt_parameters?: string;
  exclude_titles?: string[];
}

export interface SuggestPassageResponse {
  doc_id: string;
  title: string;
  domain: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  classified_topics?: string[];
  source_attribution: string;
  text: string;
  word_count: number;
  selected_sections: string;
  total_sections: number;
  selection_reason: string;
  extraction_method?: string;
  source: string;
}

export interface DrillSession {
  id: string;
  corpus_id: string;
  drill_type: string;
  current_stage: 'preflight_intent' | 'active_reading' | 'intent_recall' | 'paragraph_recap' | 'debrief' | 'completed' | 'aborted';
  started_at?: string;
  ended_at?: string;
  duration_seconds: number;
  words_per_minute: number;
  drift_count: number;
  status: 'in_progress' | 'evaluating' | 'completed' | 'aborted';
}

export interface DriftEvent {
  id: string;
  session_id: string;
  elapsed_seconds: number;
  line_number?: number | null;
  created_at?: string;
}

export interface SessionIntentDetail {
  id: string;
  session_id: string;
  focus_lens: string;
  target_question: string;
  user_synthesis?: string | null;
  response_latency_seconds?: number | null;
  created_at?: string;
}

export interface SessionDebriefDetail {
  id: string;
  session_id: string;
  core_premise: string;
  pivot_or_surprise: string;
  implication: string;
  created_at?: string;
}

export interface EvaluationResult {
  id: string;
  session_id: string;
  target_type: string;
  target_id: string;
  evaluation_status: 'completed' | 'offline_skipped' | 'failed' | 'pending';
  clarity_score?: number | null;
  conciseness_score?: number | null;
  insight_score?: number | null;
  composite_score?: number | null;
  constructive_feedback?: string | null;
  evaluator_model?: string | null;
  inference_duration_ms?: number | null;
  created_at?: string;
}

export interface SessionDetailResponse {
  session: DrillSession;
  passage: CorpusPassage;
  drift_events: DriftEvent[];
  mean_time_between_drifts: number;
  intent?: SessionIntentDetail | null;
  debrief?: SessionDebriefDetail | null;
  evaluations: EvaluationResult[];
}

export interface AnalyticsProgressResponse {
  total_sessions: number;
  completed_sessions: number;
  average_wpm: number;
  average_mtbd: number;
  total_drift_events: number;
  recent_sessions: DrillSession[];
}

export interface ConfigResponse {
  llm_base_url: string;
  llm_model: string;
  llm_timeout_seconds: number;
  is_llm_connected: boolean;
}

export interface UpdateConfigRequest {
  llm_base_url?: string;
  llm_model?: string;
  llm_timeout_seconds?: number;
}

export interface SuggestIntentResponse {
  lens: string;
  suggested_question: string;
  source: 'gemma' | 'offline_heuristic';
}

export interface SubmitIntentRequest {
  focus_lens: string;
  target_question: string;
  user_synthesis: string;
  response_latency_seconds?: number;
}

export interface SubmitDebriefRequest {
  core_premise: string;
  pivot_or_surprise: string;
  implication: string;
}
