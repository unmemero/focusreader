import React, { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type {
  ConfigResponse,
  CorpusPassage,
  DrillSession,
  SessionDetailResponse,
} from '../types';
import { SessionContext } from './session-context-definition';

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<DrillSession | null>(null);
  const [activePassage, setActivePassage] = useState<CorpusPassage | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetailResponse | null>(null);
  const [driftCount, setDriftCount] = useState<number>(0);
  const [isDistractionFree, setIsDistractionFree] = useState<boolean>(false);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
    } catch (e: any) {
      console.warn('Failed to load initial LLM config:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api
      .getConfig()
      .then((cfg) => {
        if (isMounted) setConfig(cfg);
      })
      .catch((e: any) => {
        console.warn('Failed to load initial LLM config:', e);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      const details = await api.getSession(activeSession.id);
      setActiveSession(details.session);
      setActivePassage(details.passage);
      setSessionDetails(details);
      setDriftCount(details.session.drift_count);
    } catch (e: any) {
      setError(e.message);
    }
  }, [activeSession]);

  const startNewSession = async (corpusId: string, drillType = 'sequential_pipeline') => {
    setIsLoading(true);
    setError(null);
    try {
      const passage = await api.getPassage(corpusId);
      const session = await api.startSession(corpusId, drillType);
      setActiveSession(session);
      setActivePassage(passage);
      setDriftCount(0);
      setIsDistractionFree(false);

      const details = await api.getSession(session.id);
      setSessionDetails(details);
      return session;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const recordDrift = async (elapsedSeconds: number, lineNumber?: number) => {
    if (!activeSession) return;
    try {
      await api.recordDrift(activeSession.id, elapsedSeconds, lineNumber);
      setDriftCount((prev) => prev + 1);
    } catch (e: any) {
      console.warn('Drift debounced or rejected:', e.message);
    }
  };

  const finishReadingPhase = async (durationSeconds: number) => {
    if (!activeSession) throw new Error('No active session');
    setIsLoading(true);
    try {
      const updated = await api.finishReading(activeSession.id, durationSeconds);
      setActiveSession(updated);
      await refreshSession();
      return updated;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const advanceStage = async (nextStage?: string) => {
    if (!activeSession) throw new Error('No active session');
    setIsLoading(true);
    try {
      const updated = await api.advanceStage(activeSession.id, nextStage);
      setActiveSession(updated);
      await refreshSession();
      return updated;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const abortCurrentSession = async () => {
    if (!activeSession) return;
    try {
      await api.abortSession(activeSession.id);
      setActiveSession(null);
      setActivePassage(null);
      setSessionDetails(null);
      setIsDistractionFree(false);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleDistractionFree = (force?: boolean) => {
    setIsDistractionFree((prev) => (force !== undefined ? force : !prev));
  };

  const resetActiveSession = () => {
    setActiveSession(null);
    setActivePassage(null);
    setSessionDetails(null);
    setIsDistractionFree(false);
  };

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        activePassage,
        sessionDetails,
        driftCount,
        isDistractionFree,
        config,
        isLoading,
        error,
        startNewSession,
        recordDrift,
        finishReadingPhase,
        advanceStage,
        abortCurrentSession,
        refreshSession,
        toggleDistractionFree,
        loadConfig,
        resetActiveSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
