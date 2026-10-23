import { useState, useCallback } from 'react';
import { SessionProvider } from './context/SessionContext';
import { TutorialProvider, useTutorial, type TourStep } from './context/TutorialContext';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import { useSession } from './hooks/useSession';
import { Shell } from './components/layout/Shell';
import { PreFlightIntent } from './components/drills/PreFlightIntent';
import { IndexCardPacer } from './components/drills/IndexCardPacer';
import { IntentRecall } from './components/drills/IntentRecall';
import { DebriefSynthesis } from './components/drills/DebriefSynthesis';
import { SessionResults } from './components/drills/SessionResults';
import { CorpusLibrary } from './components/corpus/CorpusLibrary';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { SettingsView } from './components/settings/SettingsView';
import { api } from './lib/api';
import type { SessionDetailResponse, SubmitDebriefRequest } from './types';
import { Sparkles, AlertCircle, BookOpen, Shuffle } from 'lucide-react';

interface AppContentProps {
  activeTab: 'drill' | 'corpus' | 'analytics' | 'settings';
  setActiveTab: (tab: 'drill' | 'corpus' | 'analytics' | 'settings') => void;
  isSelectingPassage: boolean;
  setIsSelectingPassage: (val: boolean) => void;
  onTabChange: (tab: 'drill' | 'corpus' | 'analytics' | 'settings') => void;
}

function AppContent({
  activeTab,
  setActiveTab,
  isSelectingPassage,
  setIsSelectingPassage,
  onTabChange,
}: AppContentProps) {
  const { advanceIfCurrent } = useTutorial();
  const [targetQuestion, setTargetQuestion] = useState<string>('');
  const [focusLens, setFocusLens] = useState<string>('bottleneck_tradeoff');
  const [isSubmittingStage, setIsSubmittingStage] = useState<boolean>(false);
  const [reviewDetails, setReviewDetails] = useState<SessionDetailResponse | null>(null);

  const {
    activeSession,
    activePassage,
    sessionDetails,
    driftCount,
    error,
    startNewSession,
    recordDrift,
    finishReadingPhase,
    advanceStage,
    toggleDistractionFree,
    resetActiveSession,
  } = useSession();

  const effectiveQuestion = targetQuestion || sessionDetails?.intent?.target_question || '';
  const effectiveLens = focusLens || sessionDetails?.intent?.focus_lens || 'bottleneck_tradeoff';

  // Stage 1 -> Stage 2: Preflight Intent Gate passed
  const handleStartReading = async (question: string, lens: string) => {
    setTargetQuestion(question);
    setFocusLens(lens);
    try {
      await advanceStage('active_reading');
      toggleDistractionFree(true);
      advanceIfCurrent('intent_start');
    } catch (e) {
      console.error('Failed to advance to active_reading:', e);
    }
  };

  // Stage 2 -> Stage 3: Finished Paced Reading
  const handleFinishReading = async (durationSeconds: number) => {
    try {
      toggleDistractionFree(false);
      await finishReadingPhase(durationSeconds);
      await advanceStage('intent_recall');
      advanceIfCurrent('pacer_finish');
    } catch (e) {
      console.error('Failed to finish reading phase:', e);
    }
  };

  // Stage 3 -> Stage 4: Submitted Intent Recall
  const handleSubmitRecall = async (synthesis: string, latencySeconds: number) => {
    if (!activeSession) return;
    setIsSubmittingStage(true);
    try {
      await api.submitIntent(activeSession.id, {
        focus_lens: effectiveLens,
        target_question: effectiveQuestion,
        user_synthesis: synthesis,
        response_latency_seconds: latencySeconds,
      });
      await advanceStage('debrief');
      advanceIfCurrent('recall_proceed');
    } catch (e) {
      console.error('Failed to submit intent synthesis:', e);
    } finally {
      setIsSubmittingStage(false);
    }
  };

  // Stage 4 -> Stage 5: Submitted 3-Sentence Debrief
  const handleSubmitDebrief = async (data: SubmitDebriefRequest) => {
    if (!activeSession) return;
    setIsSubmittingStage(true);
    try {
      await api.submitDebrief(activeSession.id, data);
      await advanceStage('completed');
      advanceIfCurrent('debrief_complete');
    } catch (e) {
      console.error('Failed to submit structural debrief:', e);
    } finally {
      setIsSubmittingStage(false);
    }
  };

  // Start drill from corpus library
  const handleSelectPassage = async (passageId: string) => {
    try {
      setReviewDetails(null);
      setIsSelectingPassage(false);
      await startNewSession(passageId);
      setActiveTab('drill');
      advanceIfCurrent('library_select');
    } catch (e) {
      console.error('Failed to start session with passage:', e);
    }
  };

  // Quick start random passage
  const handleQuickStartRandom = async () => {
    try {
      const random = await api.getRandomPassage();
      await handleSelectPassage(random.id);
    } catch (e) {
      console.error('Failed to get random passage:', e);
    }
  };

  // Review a historic session from analytics
  const handleReviewHistoricSession = async (sessionId: string) => {
    try {
      const details = await api.getSession(sessionId);
      setReviewDetails(details);
      setIsSelectingPassage(false);
      setActiveTab('drill');
    } catch (e) {
      console.error('Failed to review session:', e);
    }
  };

  return (
    <Shell activeTab={activeTab} onTabChange={onTabChange}>
      {error && (
        <div className="mb-4 p-3.5 bg-rose-950/50 border border-rose-800 rounded-xl flex items-center space-x-2 text-rose-200 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'drill' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* If reviewing a past session from analytics */}
          {reviewDetails ? (
            <SessionResults
              sessionDetails={reviewDetails}
              onRestart={() => {
                setReviewDetails(null);
                resetActiveSession();
                setIsSelectingPassage(true);
              }}
              onGoToAnalytics={() => {
                setReviewDetails(null);
                setActiveTab('analytics');
              }}
            />
          ) : isSelectingPassage ? (
            /* Integrated Library View inside Reading Studio */
            <CorpusLibrary
              onSelectPassage={handleSelectPassage}
              onBack={() => setIsSelectingPassage(false)}
            />
          ) : !activeSession || !activePassage ? (
            /* Empty State / Welcome Screen */
            <div className="max-w-md w-full bg-stone-900/60 border border-stone-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl text-center my-auto">
              <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-stone-100 tracking-tight mb-2 font-serif">
                Reading Studio
              </h2>
              <p className="text-xs text-stone-400 mb-6 leading-relaxed font-medium">
                Read faster. Focus deeper. Learn better.
              </p>
              <div className="space-y-3">
                <button
                  data-tour="choose-reading-btn"
                  onClick={() => {
                    setIsSelectingPassage(true);
                    advanceIfCurrent('welcome_choose');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-all shadow-lg shadow-amber-700/20 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Choose a Reading Passage</span>
                </button>
                <button
                  onClick={handleQuickStartRandom}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-700/80 bg-stone-900/50 hover:bg-stone-800 text-stone-200 font-medium text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Start Random Reading</span>
                </button>
              </div>
            </div>
          ) : (
            /* Multi-Stage Active Drill Flow */
            <div className="w-full">
              {activeSession.current_stage === 'preflight_intent' && (
                <PreFlightIntent
                  passage={activePassage}
                  onStartReading={handleStartReading}
                  onBackToLibrary={() => {
                    resetActiveSession();
                    setIsSelectingPassage(true);
                  }}
                />
              )}

              {activeSession.current_stage === 'active_reading' && (
                <IndexCardPacer
                  passage={activePassage}
                  targetQuestion={effectiveQuestion || 'Read with disciplined pacing and focus.'}
                  driftCount={driftCount}
                  onRecordDrift={(elapsed, line) => recordDrift(elapsed, line)}
                  onFinishReading={handleFinishReading}
                />
              )}

              {activeSession.current_stage === 'intent_recall' && (
                <IntentRecall
                  targetQuestion={effectiveQuestion || 'What was the primary takeaway of the text?'}
                  focusLens={effectiveLens}
                  isSubmitting={isSubmittingStage}
                  onSubmitRecall={handleSubmitRecall}
                />
              )}

              {(activeSession.current_stage === 'debrief' ||
                activeSession.current_stage === 'paragraph_recap') && (
                <DebriefSynthesis
                  isSubmitting={isSubmittingStage}
                  onSubmitDebrief={handleSubmitDebrief}
                />
              )}

              {activeSession.current_stage === 'completed' && sessionDetails && (
                <SessionResults
                  sessionDetails={sessionDetails}
                  onRestart={() => {
                    resetActiveSession();
                    setIsSelectingPassage(true);
                  }}
                  onGoToAnalytics={() => {
                    resetActiveSession();
                    setActiveTab('analytics');
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'corpus' && (
        <CorpusLibrary onSelectPassage={handleSelectPassage} />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          onSelectSession={handleReviewHistoricSession}
          onStartNewDrill={() => {
            setReviewDetails(null);
            resetActiveSession();
            setActiveTab('drill');
            setIsSelectingPassage(true);
          }}
        />
      )}

      {activeTab === 'settings' && <SettingsView />}
    </Shell>
  );
}

function AppRoot() {
  const [activeTab, setActiveTab] = useState<'drill' | 'corpus' | 'analytics' | 'settings'>('drill');
  const [isSelectingPassage, setIsSelectingPassage] = useState<boolean>(false);

  const handleTabChange = useCallback((tab: 'drill' | 'corpus' | 'analytics' | 'settings') => {
    if (tab === 'corpus') {
      setActiveTab('drill');
      setIsSelectingPassage(true);
      return;
    }
    setActiveTab(tab);
  }, []);

  const handleStepChange = useCallback((step: TourStep) => {
    if (step.id.startsWith('library_')) {
      setActiveTab('drill');
      setIsSelectingPassage(true);
    } else if (step.id === 'welcome_choose') {
      setActiveTab('drill');
      setIsSelectingPassage(false);
    } else if (step.targetTab) {
      setActiveTab(step.targetTab);
    }
  }, []);

  return (
    <TutorialProvider onStepChange={handleStepChange} onNavigateTab={handleTabChange}>
      <AppContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSelectingPassage={isSelectingPassage}
        setIsSelectingPassage={setIsSelectingPassage}
        onTabChange={handleTabChange}
      />
      <TutorialOverlay />
    </TutorialProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoot />
    </SessionProvider>
  );
}
