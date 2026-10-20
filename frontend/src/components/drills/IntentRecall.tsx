import React, { useState, useEffect } from 'react';
import { Target, Timer, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

interface IntentRecallProps {
  targetQuestion: string;
  focusLens: string;
  isSubmitting?: boolean;
  onSubmitRecall: (synthesis: string, latencySeconds: number) => void;
}

const THINK_PHASE_SECONDS = 60;
const ANSWER_PHASE_SECONDS = 60;
const TOTAL_RECALL_PACER_SECONDS = THINK_PHASE_SECONDS + ANSWER_PHASE_SECONDS;

export const IntentRecall: React.FC<IntentRecallProps> = ({
  targetQuestion,
  focusLens,
  isSubmitting = false,
  onSubmitRecall,
}) => {
  const [synthesis, setSynthesis] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerLocked, setIsTimerLocked] = useState<boolean>(false);

  // Form latency timer — pauses immediately when submitted
  useEffect(() => {
    if (isSubmitting || isTimerLocked) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitting, isTimerLocked]);

  const isThinkPhase = elapsedSeconds < THINK_PHASE_SECONDS;
  const isOvertime = elapsedSeconds > TOTAL_RECALL_PACER_SECONDS;

  const phaseRemainingSeconds = isThinkPhase
    ? THINK_PHASE_SECONDS - elapsedSeconds
    : Math.max(0, TOTAL_RECALL_PACER_SECONDS - elapsedSeconds);

  const pacerPercentage = Math.min(
    100,
    Math.round((elapsedSeconds / TOTAL_RECALL_PACER_SECONDS) * 100)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!synthesis.trim() || isSubmitting) return;
    setIsTimerLocked(true);
    onSubmitRecall(synthesis.trim(), elapsedSeconds);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      {/* Target Question Reminder Banner */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 mb-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wide text-amber-400 flex items-center space-x-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>Step 3 • Quick Recall</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-stone-700 bg-stone-800 text-stone-300">
            {focusLens.replace('_', ' ')}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-stone-100 tracking-tight mb-3 font-serif">
          &ldquo;{targetQuestion}&rdquo;
        </h2>

        <div className="flex items-center space-x-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-600/30 px-3 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>The passage is hidden to help practice retrieving key ideas from memory.</span>
        </div>
      </div>

      {/* 2-Minute Visual Pacer Progress Bar (1m Read & Think + 1m Answer) */}
      <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-medium text-stone-300">
            <Timer className="w-4 h-4 text-amber-400" />
            <span>
              {isThinkPhase
                ? 'Phase 1: Read Question & Think (1 min)'
                : 'Phase 2: Write Your Answer (1 min)'}
            </span>
          </div>
          <span
            className={`text-xs font-semibold ${
              isOvertime ? 'text-amber-400' : 'text-stone-200'
            }`}
          >
            {isOvertime
              ? `+${elapsedSeconds - TOTAL_RECALL_PACER_SECONDS}s overtime`
              : `${phaseRemainingSeconds}s remaining in phase`}
          </span>
        </div>

        <div className="relative w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
          {/* Midpoint marker dividing 1m Think and 1m Answer */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600 z-10" />
          <div
            className={`h-full transition-all duration-300 ${
              isOvertime
                ? 'bg-amber-500'
                : isThinkPhase
                ? 'bg-teal-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${pacerPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-400 mt-2">
          <span>0:00 – 1:00 • Read &amp; Think</span>
          <span>1:00 – 2:00 • Write Answer</span>
        </div>
      </div>

      {/* Synthesis Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="intent-synthesis" className="block text-sm font-semibold text-stone-200 mb-2">
            Your Answer from Memory
          </label>
          <textarea
            id="intent-synthesis"
            rows={5}
            value={synthesis}
            onChange={(e) => setSynthesis(e.target.value)}
            placeholder="Explain what you remember in your own words. Focus on the main ideas, causes, or conclusions..."
            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm leading-relaxed"
            required
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-medium text-stone-400 flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Thinking Time: {elapsedSeconds}s</span>
          </span>

          <button
            type="submit"
            disabled={!synthesis.trim() || isSubmitting}
            className="py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-all shadow-xl shadow-amber-700/20 flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{isSubmitting ? 'Saving...' : 'Proceed to Summary'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

