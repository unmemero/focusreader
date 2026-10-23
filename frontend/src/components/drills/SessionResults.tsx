import React, { useState, useEffect, useCallback } from 'react';
import type { SessionDetailResponse } from '../../types';
import { useTutorial } from '../../context/TutorialContext';
import { formatTopicLabel } from '../../lib/difficulty';
import {
  Award,
  Zap,
  Clock,
  Flag,
  RotateCcw,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Compass,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface SessionResultsProps {
  sessionDetails: SessionDetailResponse;
  onRestart: () => void;
  onGoToAnalytics: () => void;
}

const TOTAL_SLIDES = 4;

export const SessionResults: React.FC<SessionResultsProps> = ({
  sessionDetails,
  onRestart,
  onGoToAnalytics,
}) => {
  const { advanceIfCurrent } = useTutorial();
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isSavedAnswersOpen, setIsSavedAnswersOpen] = useState<boolean>(false);

  const { session, passage, mean_time_between_drifts, intent, debrief, evaluations } =
    sessionDetails;

  const evalResult = evaluations && evaluations.length > 0 ? evaluations[0] : null;
  const isOffline = evalResult?.evaluation_status === 'offline_skipped';

  const advanceSlide = useCallback(() => {
    setCurrentSlide((prev) => {
      const next = Math.min(TOTAL_SLIDES - 1, prev + 1);
      if (next === TOTAL_SLIDES - 1) {
        advanceIfCurrent('results_slides');
      }
      return next;
    });
  }, [advanceIfCurrent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        advanceSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceSlide]);

  const formattedDuration = `${Math.floor(session.duration_seconds / 60)}:${(
    session.duration_seconds % 60
  )
    .toString()
    .padStart(2, '0')}`;

  const renderReadingSummaryCards = (large = false) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <div
        className={`bg-stone-900/50 border border-stone-800 rounded-xl ${
          large ? 'p-6' : 'p-4'
        } flex flex-col`}
      >
        <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Reading Pace</span>
        </span>
        <span className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl'} font-bold text-stone-100`}>
          {session.words_per_minute}
        </span>
        <span className="text-[11px] text-stone-400 mt-auto pt-2">Words / Min</span>
      </div>

      <div
        className={`bg-stone-900/50 border border-stone-800 rounded-xl ${
          large ? 'p-6' : 'p-4'
        } flex flex-col`}
      >
        <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-2">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Duration</span>
        </span>
        <span className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl'} font-bold text-stone-100`}>
          {formattedDuration}
        </span>
        <span className="text-[11px] text-stone-400 mt-auto pt-2">Total Reading Time</span>
      </div>

      <div
        className={`bg-stone-900/50 border border-stone-800 rounded-xl ${
          large ? 'p-6' : 'p-4'
        } flex flex-col`}
      >
        <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-2">
          <Flag className="w-3.5 h-3.5 text-amber-400" />
          <span>Focus Breaks</span>
        </span>
        <span className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl'} font-bold text-stone-100`}>
          {session.drift_count}
        </span>
        <span className="text-[11px] text-stone-400 mt-auto pt-2">Times Lost Place</span>
      </div>

      <div
        className={`bg-stone-900/50 border border-stone-800 rounded-xl ${
          large ? 'p-6' : 'p-4'
        } flex flex-col`}
      >
        <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-2">
          <Award className="w-3.5 h-3.5 text-teal-400" />
          <span>Focus Streak</span>
        </span>
        <span className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl'} font-bold text-stone-100`}>
          {mean_time_between_drifts > 0 ? `${mean_time_between_drifts}s` : '∞'}
        </span>
        <span className="text-[11px] text-stone-400 mt-auto pt-2">Avg. Unbroken Focus</span>
      </div>
    </div>
  );

  const renderCoachScoresGrid = (large = false) => {
    if (isOffline) {
      return (
        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 text-sm text-stone-300 space-y-3">
          <p className="font-semibold text-amber-300">Practiced in Offline Mode.</p>
          <p className="text-xs text-stone-400 leading-relaxed">
            Your reading pace, focus streaks, and summary responses have been saved accurately.
            When the local AI assistant is connected, future readings will also include coaching
            notes and writing scores.
          </p>
        </div>
      );
    }

    if (!evalResult) {
      return (
        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 text-xs text-stone-400 text-center">
          No coach notes recorded for this reading.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
        <div
          className={`bg-stone-950/60 border border-stone-800/80 rounded-xl ${
            large ? 'p-5' : 'p-3'
          }`}
        >
          <span className="text-xs font-medium text-stone-400">Clear Expression (40%)</span>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold text-stone-100 mt-2`}>
            {evalResult.clarity_score != null ? `${evalResult.clarity_score} / 10` : '—'}
          </p>
        </div>

        <div
          className={`bg-stone-950/60 border border-stone-800/80 rounded-xl ${
            large ? 'p-5' : 'p-3'
          }`}
        >
          <span className="text-xs font-medium text-stone-400">To the Point (30%)</span>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold text-stone-100 mt-2`}>
            {evalResult.conciseness_score != null ? `${evalResult.conciseness_score} / 10` : '—'}
          </p>
        </div>

        <div
          className={`bg-stone-950/60 border border-stone-800/80 rounded-xl ${
            large ? 'p-5' : 'p-3'
          }`}
        >
          <span className="text-xs font-medium text-stone-400">Deep Understanding (30%)</span>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold text-stone-100 mt-2`}>
            {evalResult.insight_score != null ? `${evalResult.insight_score} / 10` : '—'}
          </p>
        </div>

        <div
          className={`bg-amber-950/40 border border-amber-500/35 rounded-xl ${
            large ? 'p-5' : 'p-3'
          }`}
        >
          <span className="text-xs font-medium text-amber-300">Overall Score</span>
          <p className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold text-amber-200 mt-2`}>
            {evalResult.composite_score != null ? `${evalResult.composite_score} / 10` : '—'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl text-center relative overflow-hidden">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/50 border border-emerald-600/30 text-emerald-300 mb-3">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Reading Completed!</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-stone-100 tracking-tight mb-2 font-serif">
          {passage.title}
        </h1>
        <p className="text-xs text-stone-400 font-serif italic">
          Source: {passage.source_attribution} • Category: {formatTopicLabel(passage.domain)}
        </p>
      </div>

      {/* Presentation Slide Stage */}
      <div data-tour="session-results-slide" className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 sm:p-8 min-h-[280px] flex flex-col justify-between shadow-xl">
        <div key={currentSlide} className="slide-fade-up flex-1 flex flex-col">
          {/* Slide 1: Reading Summary */}
          {currentSlide === 0 && (
            <div className="space-y-6 my-auto">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <h2 className="text-lg font-bold text-stone-100 font-serif">Reading Summary</h2>
              </div>
              {renderReadingSummaryCards(true)}
            </div>
          )}

          {/* Slide 2: AI Reading Coach Feedback (Scores) */}
          {currentSlide === 1 && (
            <div className="space-y-6 my-auto">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <h2 className="text-lg font-bold text-stone-100 font-serif">
                  AI Reading Coach Feedback
                </h2>
                {isOffline ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/50 border border-amber-600/30 text-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Offline Practice Mode</span>
                  </span>
                ) : evalResult ? (
                  <span className="text-xs font-medium text-amber-400">
                    Coach: {evalResult.evaluator_model || 'Local Gemma'}
                  </span>
                ) : null}
              </div>
              {renderCoachScoresGrid(true)}
            </div>
          )}

          {/* Slide 3: Coach Feedback & Tips */}
          {currentSlide === 2 && (
            <div className="space-y-6 my-auto">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                <h2 className="text-lg font-bold text-stone-100 font-serif flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Coach Feedback &amp; Tips</span>
                </h2>
                {evalResult?.evaluator_model && (
                  <span className="text-xs font-medium text-amber-400">
                    Coach: {evalResult.evaluator_model}
                  </span>
                )}
              </div>

              {isOffline ? (
                <div className="bg-stone-950/50 border border-stone-800 rounded-xl p-6 text-sm text-stone-300 space-y-2">
                  <p className="font-semibold text-amber-300">Practiced in Offline Mode.</p>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Connect a local AI model in Settings to receive personalized coaching tips on your
                    reading recall and 3-sentence summaries.
                  </p>
                </div>
              ) : (
                <div className="bg-stone-950/50 border border-stone-800/80 rounded-xl p-6">
                  <p className="text-base text-stone-200 leading-relaxed font-serif">
                    {evalResult?.constructive_feedback ||
                      'No coach notes recorded for this reading.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Slide 4: Full Session Report & Toggleable Saved Answers */}
          {currentSlide === 3 && (
            <div className="space-y-8">
              {/* Deterministic Reading Summary Metric Cards */}
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-stone-400 mb-3">
                  Reading Summary
                </h3>
                {renderReadingSummaryCards(false)}
              </div>

              {/* AI Reading Coach Feedback or Offline Mode */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold tracking-wider text-stone-400">
                    AI Reading Coach Feedback
                  </h3>
                  {isOffline ? (
                    <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/50 border border-amber-600/30 text-amber-300">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Offline Practice Mode</span>
                    </span>
                  ) : evalResult ? (
                    <span className="text-xs font-medium text-amber-400">
                      Coach: {evalResult.evaluator_model || 'Local Gemma'}
                    </span>
                  ) : null}
                </div>

                {isOffline ? (
                  <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 text-sm text-stone-300 space-y-3">
                    <p className="font-semibold text-amber-300">Practiced in Offline Mode.</p>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Your reading pace, focus streaks, and summary responses have been saved
                      accurately. When the local AI assistant is connected, future readings will also
                      include coaching notes and writing scores.
                    </p>
                  </div>
                ) : evalResult ? (
                  <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-6">
                    {renderCoachScoresGrid(false)}

                    {evalResult.constructive_feedback && (
                      <div className="border-t border-stone-800 pt-4">
                        <span className="text-xs font-semibold text-stone-400 block mb-2">
                          Coach Feedback &amp; Tips
                        </span>
                        <p className="text-sm text-stone-200 leading-relaxed bg-stone-950/40 p-4 rounded-xl border border-stone-800/60">
                          {evalResult.constructive_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 text-xs text-stone-400 text-center">
                    No coach notes recorded for this reading.
                  </div>
                )}
              </div>

              {/* Toggleable User Recall & Debrief Review (Closed by default) */}
              <div className="bg-stone-900/40 border border-stone-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsSavedAnswersOpen((prev) => !prev)}
                  aria-expanded={isSavedAnswersOpen}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-stone-900/70 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold tracking-wider text-stone-300">
                    Your Saved Answers
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${
                      isSavedAnswersOpen ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>

                {isSavedAnswersOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-stone-800/70 space-y-4 slide-fade-up">
                    {intent && (
                      <div className="bg-stone-950/40 border border-stone-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Guiding Question &amp; Answer from Memory</span>
                        </div>
                        <p className="text-sm font-semibold text-stone-100 font-serif">
                          &ldquo;{intent.target_question}&rdquo;
                        </p>
                        <p className="text-xs text-stone-300 bg-stone-950/60 p-3 rounded-lg border border-stone-800/80 leading-relaxed">
                          {intent.user_synthesis || 'No answer recorded'}
                        </p>
                        {intent.response_latency_seconds != null && (
                          <span className="text-xs font-medium text-stone-400 block">
                            Thinking Time: {intent.response_latency_seconds}s
                          </span>
                        )}
                      </div>
                    )}

                    {debrief && (
                      <div className="bg-stone-950/40 border border-stone-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
                          <Layers className="w-3.5 h-3.5" />
                          <span>3-Sentence Summary</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="bg-stone-950/60 p-2.5 rounded-lg border border-stone-800/80">
                            <span className="text-stone-400 block text-[11px] font-medium mb-0.5">
                              1. The Starting Fact
                            </span>
                            <span className="text-stone-200 text-xs">{debrief.core_premise}</span>
                          </div>
                          <div className="bg-stone-950/60 p-2.5 rounded-lg border border-stone-800/80">
                            <span className="text-stone-400 block text-[11px] font-medium mb-0.5">
                              2. The Turning Point
                            </span>
                            <span className="text-stone-200 text-xs">{debrief.pivot_or_surprise}</span>
                          </div>
                          <div className="bg-stone-950/60 p-2.5 rounded-lg border border-stone-800/80">
                            <span className="text-stone-400 block text-[11px] font-medium mb-0.5">
                              3. The Big Takeaway
                            </span>
                            <span className="text-stone-200 text-xs">{debrief.implication}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Next Slide Control */}
        {currentSlide < TOTAL_SLIDES - 1 && (
          <div className="flex items-center justify-end pt-6 mt-6 border-t border-stone-800/70">
            <button
              type="button"
              onClick={advanceSlide}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          data-tour="view-my-progress-btn"
          onClick={() => {
            advanceIfCurrent('results_progress');
            onGoToAnalytics();
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-700/80 hover:bg-stone-800 text-stone-300 font-medium text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <BarChart3 className="w-4 h-4" />
          <span>View My Progress</span>
        </button>

        <button
          onClick={onRestart}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Read Another Passage</span>
        </button>
      </div>
    </div>
  );
};

