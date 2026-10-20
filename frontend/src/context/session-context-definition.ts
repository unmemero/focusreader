import { createContext } from 'react';
import type {
  ConfigResponse,
  CorpusPassage,
  DrillSession,
  SessionDetailResponse,
} from '../types';

export interface SessionContextType {
  activeSession: DrillSession | null;
  activePassage: CorpusPassage | null;
  sessionDetails: SessionDetailResponse | null;
  driftCount: number;
  isDistractionFree: boolean;
  config: ConfigResponse | null;
  isLoading: boolean;
  error: string | null;
  startNewSession: (corpusId: string, drillType?: string) => Promise<DrillSession>;
  recordDrift: (elapsedSeconds: number, lineNumber?: number) => Promise<void>;
  finishReadingPhase: (durationSeconds: number) => Promise<DrillSession>;
  advanceStage: (nextStage?: string) => Promise<DrillSession>;
  abortCurrentSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  toggleDistractionFree: (force?: boolean) => void;
  loadConfig: () => Promise<void>;
  resetActiveSession: () => void;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);
