import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';

describe('Frontend API Client (Unit Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getHealth fetches /api/health and returns payload', async () => {
    const mockHealth = {
      status: 'ok',
      version: '0.1.0',
      timestamp: '2026-10-06T00:00:00Z',
      database: 'connected',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response);

    const res = await api.getHealth();
    expect(res).toEqual(mockHealth);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/health', expect.any(Object));
  });

  it('getCorpus applies optional domain query parameter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await api.getCorpus('physics');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/corpus?domain=physics', expect.any(Object));

    await api.getCorpus();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/corpus', expect.any(Object));
  });

  it('startSession posts to /api/sessions/start with corpus_id and drill_type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sess_123', status: 'in_progress' }),
    } as Response);

    const session = await api.startSession('seed_cs_rfc9110', 'sequential_pipeline');
    expect(session.id).toBe('sess_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/sessions/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ corpus_id: 'seed_cs_rfc9110', drill_type: 'sequential_pipeline' }),
      })
    );
  });

  it('handles server error responses properly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid domain' }),
    } as Response);

    await expect(api.getCorpus('invalid_domain')).rejects.toThrow('Invalid domain');
  });
});
