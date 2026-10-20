# Software Requirements Specification (SRS): FocusReader

## 1. System Vision & Architectural Constraints

FocusReader is a local-first desktop application designed to treat reading comprehension and retention difficulties through targeted cognitive exercises. It directly targets root causes: visual drift, subvocal anxiety regarding speed, cognitive overflow, and lack of target focus.

### Core Architectural Constraints
- **Architecture Style:** Decoupled client-server architecture orchestrated via Docker Compose, as well as runnable standalone natively on `localhost`.
- **Backend:** Rust (`Axum` web daemon running on `localhost:3001` or port configured via environment).
- **Frontend:** React Single Page Application (Vite + Tailwind CSS + Lucide icons + headless UI primitives) running on `localhost:3000` (or `localhost:5173` in development mode).
- **Orchestration:** Multi-container `docker-compose.yml` linking the Rust backend service, the React frontend, persistent volumes for the local database, and optional host/container bridge to local LLM engines.
- **Database Engine:** Embedded LibreSQL (`libsql` crate in local file mode). Zero external database servers required. Persistent storage resides in a configurable data directory or mounted Docker volume.
- **LLM Engine:** Local OpenAI-compatible HTTP endpoint (e.g., `llama.cpp` serving **Gemma**, or Ollama/vLLM). Endpoint URL, model name (default: Gemma), request timeout, and inference parameters are user-configurable.
- **Deterministic Offline Resilience:** The application is fully functional offline or when the LLM daemon is unreachable. Deterministic metrics (Words Per Minute, active reading duration, drift event counts, formulation latency) are computed and persisted immediately. When offline, semantic evaluations are cleanly flagged as `offline_skipped` or `pending` without failing drill sessions.
- **Content Authenticity Policy:** Texts used for drills must be short (150–450 words), free-to-use, and sourced from actual public domain texts, open-access research excerpts (CC-BY), or permissive technical specifications (RFCs). **Passages must NOT be generated or hallucinated by an LLM.** 
- **Starter Seed & Ingestion:** The repository bundles a pre-populated seed of authentic excerpts across five core domains. A dedicated text ingestion pipeline allows users to import custom articles or documents, auto-chunking them into 150–450 word passages with computed lexical density scores.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React Frontend SPA (localhost:3000)                  │
│   • Distraction-free, isolated reading viewport                        │
│   • Reverse index-card line shroud & visual pacer                      │
│   • Keyboard-driven controls (Space, Down/J, Enter)                    │
│   • Sequential drill workflow state manager                            │
│   • Analytics visualizations (FRI, MTBD, Formulation Latency)          │
│   • Text ingestion dialog & LLM configuration panel                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ JSON over HTTP / WebSocket (/api/*)
┌──────────────────────────────────▼─────────────────────────────────────┐
│                    Rust Axum Daemon (localhost:3001)                   │
│   • Sequential Drill State Machine & Session Orchestrator              │
│   • Deterministic Score Aggregator & Real-time Drift Tracker           │
│   • Corpus Ingestion Pipeline (Chunker, Lexical Density Analyzer)      │
│   • llama.cpp / Gemma Client (Structured JSON schema evaluations)      │
│   • Offline Resilience & Graceful Fallback Handler                     │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
┌──────────────────▼───────────────┐ ┌───────────────▼───────────────────┐
│     LibreSQL Local Database      │ │      llama.cpp / Gemma Daemon     │
│   • Reading corpus & seed texts  │ │   • Configurable OpenAI endpoint  │
│   • Drill sessions & drift logs  │ │   • Structured JSON completions   │
│   • Intents, recaps & debriefs   │ │   • Focus question suggestion     │
│   • Evaluation rubrics & scores  │ │   • Offline fallback supported    │
└──────────────────────────────────┘ └───────────────────────────────────┘
```

---

## 3. Database Schema Requirements (LibreSQL)

The embedded database enforces relational integrity for texts, sessions, multi-stage drill inputs, and evaluations.

```sql
-- Application configuration (LLM connection, model name, and user preferences)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catalog of authentic, non-generated source texts
CREATE TABLE IF NOT EXISTS reading_corpus (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT CHECK(domain IN ('general_humanities', 'physics', 'chemistry', 'computer_science', 'biology')) NOT NULL,
    source_attribution TEXT NOT NULL,   -- e.g., "RFC 9110", "Project Gutenberg #1342", "ArXiv 1706.03762 (CC-BY)"
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
        'sequential_pipeline',       -- Standard full multi-stage drill flow
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
    drift_count INTEGER DEFAULT 0,       -- Count of manual drift signals (Spacebar)
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

-- Paragraph-level micro recaps (for One-Breath Recall mode)
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
```

---

## 4. Sequential Reading Workflow & Drill Pipeline

Each reading session follows a sequential cognitive training pipeline where exercises progress one after the other. All countdown timers act as **visual pacers**, never as punitive hard lockouts.

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Pre-Flight Intent Gate                             │
│ • Select Lens (Bottleneck, Mechanism, Core Claim, Custom)   │
│ • Formulate / Suggest target extraction question            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Stage 2: Active Reading Phase                               │
│ • Reverse Index-Card Pacer: Unmasked active line, top shroud│
│ • Visual Drift Flagging (Spacebar) & real-time WPM tracker  │
│ • (Or One-Breath Paragraph Pacer with countdown cadence)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Stage 3: Immediate Intent Recall                            │
│ • Source text vanishes; 60s pacer to answer pre-flight intent│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Stage 4: 3-Sentence Synthesis Debrief                       │
│ • Core Premise ➔ Pivot / Nuance ➔ Implication               │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Stage 5: Deterministic & Semantic Scoring                   │
│ • Deterministic Stats: WPM, Mean Time Between Drifts (MTBD) │
│ • Gemma Semantic Eval: Clarity (40%), Brevity (30%), Insight│
│ • Offline Fallback: Gracefully saves stats if LLM is offline│
└─────────────────────────────────────────────────────────────┘
```

### Stage 4.1: The Pre-Flight Intent Gate
- **Cognitive Target:** Solves working memory overload and passive reading by priming attention with an explicit search target.
- **Workflow:**
  - Before text is shown, user selects an analytical lens:
    1. *Bottleneck & Trade-off* (Technical/Engineering)
    2. *Mechanism & Invariant* (Scientific/Physical)
    3. *Core Claim & Leverage Point* (Essays/Argumentative)
    4. *Custom Question*
  - User writes a 1-sentence pre-flight target question (optional: user clicks "Suggest Focus Question" to have Gemma analyze passage metadata and suggest one).
  - User confirms readiness and advances to active reading.

### Stage 4.2: Active Reading (Reverse Index-Card Pacer & Drift Flagging)
- **Cognitive Target:** Eliminates eye-mind drift, speed anxiety, and regression (backtracking).
- **Workflow:**
  - Active passage is displayed in a constrained, distraction-free column.
  - An opaque shroud sits **above** the active line, covering text once the reader advances past it.
  - Reader advances using `Down Arrow`, `J`, or a configurable auto-scroll pacer.
  - Pressing `Spacebar` flags a focus drift event instantly, recording timestamp and active line number to LibreSQL without interrupting reading cadence.
  - Optional mode: **Deliberate Slowdown Calibration** enforces a steady 120–150 WPM pacer for dense prose and records post-drill autonomic tension (1–5 scale).
  - Optional mode: **One-Breath Paragraph Recall** chunks text paragraph-by-paragraph, hiding paragraph $N$ upon advance with a 5-second countdown pacer prompt before paragraph $N+1$ unlocks.

### Stage 4.3: Immediate Intent Recall
- **Cognitive Target:** Exercises instantaneous working memory retrieval.
- **Workflow:**
  - Immediately upon completing the reading, the passage is concealed.
  - The pre-flight target question is displayed.
  - A 60-second visual pacer bar counts down while the user writes a 1–2 sentence synthesis.
  - Exceeding 60 seconds does not lock the screen or abort the session; it signals to the user that retrieval latency is exceeding target pacing.

### Stage 4.4: 3-Sentence Synthesis Debrief
- **Cognitive Target:** Synthesizes short-term memory into structured schemas.
- **Workflow:**
  - With the source passage hidden, user completes three compulsory structured fields:
    1. **Core Premise:** Central subject or initial state.
    2. **Pivot / Nuance:** The complication, surprise, contradiction, or trade-off.
    3. **Implication:** The systemic consequence, forecast, or takeaway.

### Stage 4.5: Deterministic & Semantic Scoring
- **Deterministic Feedback:** WPM, reading duration, drift count, and formulation latency are calculated immediately and displayed without blocking.
- **Gemma Semantic Evaluation:** Syntheses are submitted to the local Gemma model. Scores and non-punitive feedback are streamed or updated asynchronously. If Gemma is unreachable, deterministic results remain intact and evaluation status is marked `offline_skipped`.

---

## 5. Local LLM (Gemma via `llama.cpp`) Integration

### 5.1 Endpoint Configuration
Configurable via settings UI and stored in `app_config`:
- **Base URL:** (Default: `http://localhost:8080` or `http://host.docker.internal:8080`)
- **API Path:** (Default: `/v1/chat/completions`)
- **Model Identifier:** (Default: `gemma-2-9b-it` or user-specified Gemma model)
- **Request Timeout:** In seconds (Default: 15s)
- **Temperature:** Low (0.1–0.2) to maintain deterministic grading consistency.

### 5.2 Structured Output Schema
The Rust backend transmits prompts instructing the model to respond in valid JSON with the following schema:

```json
{
  "clarity_score": 0.85,
  "conciseness_score": 0.90,
  "insight_score": 0.80,
  "composite_score": 0.85,
  "constructive_feedback": "Accurately captured the core memory latency trade-off. Rewarded for clear formulation."
}
```

### 5.3 Evaluation Rubric
- **Clarity ($0.0 - 1.0$, Weight: 40%):** Concept explained in reader's own intelligible words rather than parroted text.
- **Conciseness ($0.0 - 1.0$, Weight: 30%):** Conciseness rewarded; optimal answer length is 15–35 words.
- **Insight / Target Match ($0.0 - 1.0$, Weight: 30%):** Direct responsiveness to pre-flight intent or debrief field.
- **Tone:** Encouraging, constructive, and non-punitive. Colloquial formulation and minor typos are accepted without penalty.

---

## 6. Corpus Ingestion & Starter Seed

### 6.1 Bundled Starter Seed
The repository includes pre-seeded authentic excerpts across five core domains:
- **Computer Science:** RFC 9110 (HTTP Semantics), Shannon (Mathematical Theory of Communication).
- **Physics:** Einstein (On the Electrodynamics of Moving Bodies, 1905), Feynman Lectures on Physics.
- **Biology:** Darwin (The Origin of Species - Natural Selection), Watson & Crick (Molecular Structure of Nucleic Acids).
- **Chemistry:** Mendeleev (The Periodic Law of the Chemical Elements), Lavoisier (Elements of Chemistry).
- **General Humanities:** Marcus Aurelius (Meditations), Adam Smith (The Wealth of Nations).

### 6.2 Manual Text Ingestion Pipeline
Users can ingest custom articles, RFCs, documentation, or public domain texts:
- Input via UI dialog: Title, Domain, Source Attribution, and raw text/markdown.
- The backend processor:
  1. Sanitizes whitespace and structural artifacts.
  2. Measures total word count and calculates lexical density (type-token ratio of lexical items).
  3. Splits long texts into coherent 150–450 word passages if needed.
  4. Stores validated records into `reading_corpus`.

---

## 7. Rust Backend API Contract

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/config` | Retrieves current configuration and LLM connection status. |
| `POST` | `/api/config` | Updates connection settings and performs a live ping against `llama.cpp`. |
| `GET` | `/api/corpus` | Lists or filters available passages in the reading catalog. |
| `GET` | `/api/corpus/random?domain={d}` | Fetches an authentic reading passage from LibreSQL. |
| `POST` | `/api/corpus/ingest` | Ingests, analyzes, chunks, and stores custom user text into the corpus. |
| `POST` | `/api/sessions/start` | Initializes a new drill session with specified passage and pipeline type. |
| `POST` | `/api/sessions/:id/drift` | Logs a timestamped focus-drift event during active reading. |
| `POST` | `/api/sessions/:id/submit-intent` | Submits pre-flight intent and answers; triggers Gemma scoring with offline fallback. |
| `POST` | `/api/sessions/:id/submit-debrief`| Submits 3-sentence debrief; triggers Gemma scoring with offline fallback. |
| `GET` | `/api/sessions/:id` | Returns complete session state, deterministic stats, and evaluations. |
| `GET` | `/api/analytics/progress` | Computes time-series metrics: WPM trend, MTBD, and Focus Retention Index. |

---

## 8. Frontend (React) State & UX Requirements

1. **Distraction-Free Isolation:**
   - Active reading view hides top navigation, sidebars, and ambient borders.
2. **Keyboard Ergonomics:**
   - Single-key bindings for fluid execution:
     - `Down` / `J`: Advance unmasked line.
     - `Space`: Record visual drift flag.
     - `Enter`: Advance to next phase / submit input.
     - `Escape`: Abort session safely with confirmation.
3. **Pacer UX:**
   - Timers render as gentle progress bars and pulse subtly at threshold without blocking user typing or reading.
4. **Analytics Visualizations:**
   - **Focus Retention Index (FRI):** Rolling composite score across recent sessions.
   - **Mean Time Between Drifts (MTBD):** Attention span duration in seconds between drift spacebar presses.
   - **Formulation Latency Curve:** Trend of response latency in seconds.

---

## 9. Docker Deployment Specification

A root `docker-compose.yml` provides simple single-command deployment:
- **`backend` service:** Rust Alpine/Debian slim binary, exposing port `3001`, with volume mount `./data` for the `libsql` SQLite file.
- **`frontend` service:** Nginx serving the compiled Vite React client on port `3000`, with internal reverse-proxy routing `/api` requests to `backend:3001`.
- **Host LLM Bridge:** Pre-configured environment variables pointing to `http://host.docker.internal:8080/v1` for easy connection to a host-running `llama.cpp` instance with Gemma.