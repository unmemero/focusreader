# FocusReader

> A local-first cognitive reading therapy application designed to treat visual drift, speed anxiety, working memory overload, and retention deficits through targeted cognitive constraints.

---

## 1. Overview & Cognitive Principles

Many readers struggle with comprehension and retention due to specific mechanical and cognitive bottlenecks:
- **Visual Drift & Chronic Regression:** Eyes slip off lines or repeatedly re-read the previous sentence out of compulsive doubt.
- **Speed & Subvocal Anxiety:** Forcing a high reading pace leads to words registering visually without conceptual processing.
- **Cognitive Overflow:** Reading without an explicit search target causes working memory overload.
- **Lack of Synthesis:** Finishing a text without immediately translating impressions into long-term structured schemas.

**FocusReader** treats these symptoms directly using active cognitive pacing, line-by-line shrouds, target filters, and structured immediate debriefs.

### Non-Generative Invariant
Texts used for drills must be authentic human prose (public-domain classics, open-access CC-BY research papers, and technical RFC specifications). **Texts are never hallucinated by an LLM.** A local model (Gemma via `llama.cpp`) serves exclusively as an excerpt curator, pre-flight question assistant, and semantic synthesis evaluator.

---

## 2. The 5-Stage Sequential Reading Pipeline

Every reading session progresses through a continuous multi-stage cognitive drill workflow:

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

1. **Pre-Flight Intent Gate:** Prime attention before exposure. Select an analytical lens (*Bottleneck & Trade-off*, *Mechanism & Invariant*, *Core Claim & Leverage Point*, or *Custom*) and define a concrete 1-sentence extraction goal.
2. **Reverse Index-Card Pacer (Active Reading):** A visual opaque shroud covers text **above** the active line as you read down, eliminating regression and backtracking. Pressing `Spacebar` flags moments of mental drift without breaking reading flow.
3. **Immediate Intent Recall:** The text immediately vanishes. A 60-second visual pacer bar guides you to answer your pre-flight target question in 1–2 sentences.
4. **3-Sentence Synthesis Debrief:** Formulate three structured schemas:
   - *Core Premise:* Starting state or foundational thesis.
   - *Pivot / Nuance:* Complication, tension, or trade-off.
   - *Implication:* Practical outcome or systemic consequence.
5. **Deterministic & Semantic Scoring:** Immediate calculation of WPM, Mean Time Between Drifts (MTBD), and formulation latency, paired with asynchronous semantic feedback from a local Gemma model.

---

## 3. Technology Stack

- **Backend Daemon:** Rust with **Axum**, **Tokio**, and **Tower-HTTP**.
- **Database:** Local embedded **LibreSQL** (`libsql` crate in file mode, zero external DB dependencies).
- **Frontend SPA:** **React**, **Vite**, **TypeScript**, and **Tailwind CSS** (minimalist typography, distraction-free reading viewport, keyboard-first controls).
- **Inference Engine:** Local OpenAI-compatible server (e.g. `llama.cpp` serving **Gemma 2**, Ollama, or vLLM).
- **Orchestration:** **Docker Compose** linking the Rust daemon, React frontend, and persistent data volume.

---

## 4. Resilience & Deterministic Offline Mode

FocusReader is designed to be **100% functional offline**:
- If `llama.cpp` is not running or unreachable, drill sessions complete smoothly without errors.
- Deterministic measurements (reading duration, exact WPM, drift count, formulation latencies) are calculated and recorded immediately.
- Semantic evaluations are marked as `offline_skipped` or `pending` and can be evaluated once the LLM is connected.

---

## 5. Quickstart with Docker Compose

Ensure Docker and Docker Compose are installed on your system.

```bash
# Clone and enter the repository
git clone https://github.com/your-username/reading-comprehension.git
cd reading-comprehension

# Build and start all services
docker compose up --build
```

- **Frontend Client:** Open [http://localhost:3000](http://localhost:3000)
- **Backend API:** Accessible at [http://localhost:3001/api](http://localhost:3001/api)
- **Persistent Data:** SQLite file stored in the `./data` volume.

---

## 6. Local Development Setup

### Backend (Rust)
Prerequisites: Rust toolchain (`cargo` and `rustc` >= 1.80).

```bash
cd backend
cargo run
# Daemon starts on http://localhost:3001
```

### Frontend (React + Vite)
Prerequisites: Node.js (>= 18) and `npm`.

```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on http://localhost:5173
```

---

## 7. Connecting Local LLM (Gemma via `llama.cpp`)

FocusReader works with any OpenAI-compatible `/v1/chat/completions` endpoint. Recommended setup using `llama.cpp` and Gemma:

```bash
# Example running llama.cpp server with Gemma
./llama-server \
  -m models/gemma-2-9b-it.Q5_K_M.gguf \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 99
```

In FocusReader's **Settings** panel (or via `/api/config`):
- **Base URL:** `http://localhost:8080` (or `http://host.docker.internal:8080` if using Docker)
- **Model Name:** `gemma-2-9b-it` (or your loaded model name)
- **Temperature:** `0.1` (keeps evaluation rubrics deterministic)

---

## 8. Keyboard Controls

FocusReader emphasizes fluid keyboard navigation during reading drills:

| Key | Context | Action |
| :--- | :--- | :--- |
| `Down` / `J` | Active Reading (Pacer) | Advance unmasked line forward |
| `Space` | Active Reading (Pacer) | Flag a visual/mental drift event |
| `Enter` | All Drill Stages | Confirm / Advance to next stage |
| `Esc` | Active Reading | Pause or exit session safely |

---

## 9. Reading Corpus & Custom Ingestion

### Bundled Starter Seed
The application automatically seeds a library of authentic 150–450 word excerpts across five domains:
- **Computer Science:** RFC 9110 (HTTP Semantics), Shannon's Information Theory.
- **Physics:** Einstein (Special Relativity, 1905), Feynman Lectures.
- **Biology:** Darwin (*Origin of Species*), Watson & Crick (DNA Structure).
- **Chemistry:** Mendeleev (Periodic Law), Lavoisier (Conservation of Mass).
- **General Humanities:** Marcus Aurelius (*Meditations*), Adam Smith (*Wealth of Nations*).

### Ingesting Custom Texts
Use the in-app **Ingest Text** dialog (or `POST /api/corpus/ingest`) to add your own articles, research excerpts, or book chapters:
- Automatically strips boilerplate and formatting noise.
- Analyzes total word count and computes lexical density.
- Automatically divides long documents into clean 150–450 word drill passages.

---

## 10. API Contract Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/config` | Get LLM connection settings & health |
| `POST` | `/api/config` | Update settings & test connection |
| `GET` | `/api/corpus` | List reading corpus entries |
| `GET` | `/api/corpus/random?domain={d}` | Fetch a random passage by domain |
| `POST` | `/api/corpus/ingest` | Ingest and chunk custom source text |
| `POST` | `/api/sessions/start` | Initialize a new drill session |
| `POST` | `/api/sessions/:id/drift` | Record timestamped drift event |
| `POST` | `/api/sessions/:id/submit-intent` | Submit pre-flight answer & trigger eval |
| `POST` | `/api/sessions/:id/submit-debrief`| Submit 3-sentence debrief & trigger eval |
| `GET` | `/api/sessions/:id` | Get full session telemetry & scores |
| `GET` | `/api/analytics/progress` | Get rolling trends (WPM, MTBD, FRI) |

---

## 11. License

FocusReader is open-source under the MIT License. All starter corpus texts are sourced from public domain works or permissive Creative Commons (CC-BY) publications.
