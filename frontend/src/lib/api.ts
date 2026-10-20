import type {
  AnalyticsProgressResponse,
  ConfigResponse,
  CorpusPassage,
  DrillSession,
  DriftEvent,
  HealthResponse,
  IngestRequest,
  IngestResponse,
  SessionDetailResponse,
  SubmitDebriefRequest,
  SubmitIntentRequest,
  SuggestIntentResponse,
  SuggestPassageRequest,
  SuggestPassageResponse,
  UpdateConfigRequest,
} from '../types';

const getBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env?.VITEST) {
    return 'http://localhost:3000';
  }
  return '';
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${getBaseUrl()}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>('/api/health'),

  // Config
  getConfig: () => request<ConfigResponse>('/api/config'),
  updateConfig: (data: UpdateConfigRequest) =>
    request<ConfigResponse>('/api/config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Corpus
  getCorpus: (domain?: string) => {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return request<CorpusPassage[]>(`/api/corpus${query}`);
  },
  getPassages: (domain?: string) => {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return request<CorpusPassage[]>(`/api/corpus${query}`);
  },
  getRandomPassage: (domain?: string) => {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return request<CorpusPassage>(`/api/corpus/random${query}`);
  },
  getPassage: (id: string) => request<CorpusPassage>(`/api/corpus/${encodeURIComponent(id)}`),
  ingestPassage: (data: IngestRequest) =>
    request<IngestResponse>('/api/corpus/ingest', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  ingestCorpus: (data: IngestRequest) =>
    request<IngestResponse>('/api/corpus/ingest', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  suggestPassage: (data: SuggestPassageRequest = {}) =>
    request<SuggestPassageResponse>('/api/corpus/suggest-passage', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  suggestIntent: (passageId: string, lens?: string) =>
    request<SuggestIntentResponse>(`/api/corpus/${encodeURIComponent(passageId)}/suggest-intent`, {
      method: 'POST',
      body: JSON.stringify({ lens }),
    }),

  // Sessions & Telemetry
  startSession: (corpusId: string, drillType?: string) =>
    request<DrillSession>('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ corpus_id: corpusId, drill_type: drillType }),
    }),
  getSession: (id: string) => request<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(id)}`),
  recordDrift: (sessionId: string, elapsedSeconds: number, lineNumber?: number) =>
    request<DriftEvent>(`/api/sessions/${encodeURIComponent(sessionId)}/drift`, {
      method: 'POST',
      body: JSON.stringify({ elapsed_seconds: elapsedSeconds, line_number: lineNumber }),
    }),
  finishReading: (sessionId: string, durationSeconds: number) =>
    request<DrillSession>(`/api/sessions/${encodeURIComponent(sessionId)}/finish-reading`, {
      method: 'POST',
      body: JSON.stringify({ duration_seconds: durationSeconds }),
    }),
  advanceStage: (sessionId: string, nextStage?: string) =>
    request<DrillSession>(`/api/sessions/${encodeURIComponent(sessionId)}/advance`, {
      method: 'POST',
      body: JSON.stringify({ next_stage: nextStage }),
    }),
  abortSession: (sessionId: string) =>
    request<DrillSession>(`/api/sessions/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
    }),

  // Submissions & Scoring
  submitIntent: (sessionId: string, data: SubmitIntentRequest) =>
    request<{ intent: any; evaluation: any }>(`/api/sessions/${encodeURIComponent(sessionId)}/submit-intent`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitDebrief: (sessionId: string, data: SubmitDebriefRequest) =>
    request<{ debrief: any; evaluation: any }>(`/api/sessions/${encodeURIComponent(sessionId)}/submit-debrief`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Analytics
  getAnalytics: () => request<AnalyticsProgressResponse>('/api/analytics/progress'),
};
