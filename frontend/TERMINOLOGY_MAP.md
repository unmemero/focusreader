# FocusReader: Educational Terminology Map

This document defines the mapping between **internal application variables** (database schema, API routes, and code types) and **classroom-friendly user interface labels** presented to teachers and students.

---

## 1. Primary Navigation & App Shell

| Code / Schema Identifier | Technical Term | Classroom UI Label | Educational Context / Teacher Note |
| :--- | :--- | :--- | :--- |
| `activeTab === 'drill'` | Cognitive Drill Studio | **Reading Studio** | Friendly, constructive environment for guided practice. |
| `activeTab === 'corpus'` | Curated Authentic Corpus | **Reading Library** | Collection of authentic, non-hallucinated texts. |
| `activeTab === 'ingest'` | Manual Text Ingestion | **Add Reading** | Easy-to-understand button for teachers importing articles. |
| `activeTab === 'analytics'` | Longitudinal Telemetry | **My Progress** | Student performance, pace history, and streaks over time. |
| `activeTab === 'settings'` | Engine & Local Inference | **Settings** | Setup for local offline LLM / AI Reading Coach. |

---

## 2. 5-Stage Guided Reading Pipeline

| Stage / DB State | Technical Term | Classroom UI Label | Student Instructions / Tooltip |
| :--- | :--- | :--- | :--- |
| `preflight_intent` | Stage 1: Pre-Flight Intent Gate | **Step 1: Set Your Reading Goal** | *"Before you read, pick what you are looking for."* |
| `focus_lens: bottleneck_tradeoff` | Bottleneck & Trade-off | **Problems & Solutions** | Identifying limits, puzzles, and trade-offs. |
| `focus_lens: mechanism_invariant` | Mechanism & Invariant | **How It Works** | Following scientific processes, cause, and effect. |
| `focus_lens: core_claim` | Core Claim & Leverage | **Main Idea & Arguments** | Discovering the main argument and evidence. |
| `focus_lens: custom` | Custom Focus | **My Own Question** | Formulating a student's own inquiry question. |
| `active_reading` | Stage 2: Shrouded Pacer | **Step 2: Guided Reading** | Line-by-line reading with anti-regression focus cover. |
| *(Visual component)* | Index Card Shroud | **Reading Ruler** | Dimming earlier lines like a physical classroom reading ruler. |
| `drift_events` / `recordDrift` | Flag Drift / Drift Event | **Lost My Place** | Normalizes attention wander; tap when eyes lose their place. |
| `intent_recall` | Stage 3: Active Retrieval Gate | **Step 3: Quick Recall** | Text is hidden to practice retrieving key ideas from memory. |
| *(Timer)* | 60s Visual Pacer | **1-Minute Memory Challenge** | Gentle visual pacer encouraging retrieval practice without panic. |
| `response_latency_seconds` | Formulation Latency | **Thinking Time** | Seconds spent formulating the recall synthesis. |
| `debrief` / `session_debriefs` | Stage 4: 3-Sentence Debrief | **Step 4: 3-Sentence Summary** | Structured deconstruction into beginning, turn, and takeaway. |
| `core_premise` | Foundational Premise | **1. The Starting Fact** | *"What is the background situation or topic?"* |
| `pivot_or_surprise` | Pivot / Tension / Mechanism | **2. The Turning Point** | *"What happens next, or what is the big surprise/puzzle?"* |
| `implication` | Downstream Implication | **3. The Big Takeaway** | *"Why does this matter, or what does it teach us?"* |
| `completed` / `evaluations` | Stage 5: Session Results | **Step 5: Reading Report** | Comprehensive summary of speed, focus, and coaching feedback. |

---

## 3. Metrics & Diagnostic Telemetry

| Code Identifier | Technical Metric | Classroom Label | Display Example |
| :--- | :--- | :--- | :--- |
| `words_per_minute` (WPM) | Reading Speed | **Reading Pace** | `240 words / min` |
| `drift_count` | Drift Events | **Focus Breaks** | `2 times lost place` |
| `mean_time_between_drifts` | MTBD | **Focus Streak** | `Avg. 35s unbroken focus` |
| `clarity_score` | Clarity (40%) | **Clear Expression** | `8 / 10` |
| `conciseness_score` | Conciseness (30%) | **To the Point** | `9 / 10` |
| `insight_score` | Insight (30%) | **Deep Understanding** | `8 / 10` |
| `composite_score` | Composite Score | **Overall Score** | `8.3 / 10` |
| `evaluation_status: offline_skipped` | Offline Skipped | **Offline Practice Mode** | Telemetry recorded; AI coach was offline. |

---

## 4. Ingestion, Analytics, & Settings Views

| Code / Schema Identifier | Technical Term | Classroom UI Label | Educational Context / Teacher Note |
| :--- | :--- | :--- | :--- |
| `ingestCorpus` form | Ingest Authentic Text / Chunking | **Add a Reading Passage** | Simple form for teachers to paste articles or book excerpts. |
| `domain` field | Domain | **Subject Area** | Category of the passage (Humanities, Biology, Physics, etc.). |
| `source_attribution` | Source Attribution | **Author / Source** | Citation or author credit for the reading. |
| `passage_text` field | Source Text | **Passage Text** | The actual reading material pasted by the teacher. |
| `is_llm_connected` | LLM Online / Offline | **AI Coach Ready / Offline Practice Mode** | Clear status indicator for offline vs. AI-assisted mode. |
| `llm_base_url` | LLM Base URL | **Local AI Server URL** | Endpoint address for local inference. |
| `llm_model` | Model Identifier | **Model Name** | Local model (e.g., Gemma 2). |
| `AnalyticsDashboard` | Cognitive Diagnostics | **Reading Progress & History** | Longitudinal view of student reading growth. |
| `completed_sessions` | Completed Drills | **Readings Completed** | Number of finished reading passages. |

---

## 5. Architectural Invariant

> **Strict Rule:** Changing user-facing text labels in the React components MUST NOT rename underlying API endpoints, database columns, JSON keys, or TypeScript interfaces. All network payloads (`corpus_id`, `drill_type`, `drift_count`, `words_per_minute`, `preflight_intent`, etc.) remain identical for full API stability.
