import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, Layers, HelpCircle } from 'lucide-react';
import type { SubmitDebriefRequest } from '../../types';

interface DebriefSynthesisProps {
  isSubmitting?: boolean;
  onSubmitDebrief: (data: SubmitDebriefRequest) => void;
}

export const DebriefSynthesis: React.FC<DebriefSynthesisProps> = ({
  isSubmitting = false,
  onSubmitDebrief,
}) => {
  const [corePremise, setCorePremise] = useState<string>('');
  const [pivot, setPivot] = useState<string>('');
  const [implication, setImplication] = useState<string>('');

  const isValid =
    corePremise.trim().length > 0 &&
    pivot.trim().length > 0 &&
    implication.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    onSubmitDebrief({
      core_premise: corePremise.trim(),
      pivot_or_surprise: pivot.trim(),
      implication: implication.trim(),
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      {/* Header Info */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 mb-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold tracking-wide text-amber-400 flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Step 4 • 3-Sentence Summary</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-600/30 bg-emerald-950/50 text-emerald-300">
            Core Understanding
          </span>
        </div>

        <h2 className="text-2xl font-bold text-stone-100 tracking-tight mb-2 font-serif">
          3-Sentence Summary
        </h2>
        <p className="text-sm text-stone-400">
          Summarize what you read in three clear steps: the starting situation, the turning point, and the big takeaway.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sentence 1: Core Premise */}
        <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="core-premise"
              className="text-sm font-semibold text-stone-200 flex items-center space-x-2"
            >
              <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-semibold text-xs flex items-center justify-center">
                1
              </span>
              <span>Sentence 1: The Starting Fact</span>
            </label>
            <span className="text-xs text-stone-400 flex items-center space-x-1">
              <HelpCircle className="w-3 h-3" />
              <span>What is the background situation or main topic?</span>
            </span>
          </div>
          <textarea
            id="core-premise"
            rows={2}
            value={corePremise}
            onChange={(e) => setCorePremise(e.target.value)}
            placeholder="e.g. In the beginning, the author introduces the basic idea that..."
            className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
            required
          />
        </div>

        {/* Sentence 2: Pivot / Complication */}
        <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="pivot-surprise"
              className="text-sm font-semibold text-stone-200 flex items-center space-x-2"
            >
              <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-semibold text-xs flex items-center justify-center">
                2
              </span>
              <span>Sentence 2: The Turning Point</span>
            </label>
            <span className="text-xs text-stone-400 flex items-center space-x-1">
              <HelpCircle className="w-3 h-3" />
              <span>What happens next, or what is the big surprise or problem?</span>
            </span>
          </div>
          <textarea
            id="pivot-surprise"
            rows={2}
            value={pivot}
            onChange={(e) => setPivot(e.target.value)}
            placeholder="e.g. However, a new challenge or discovery reveals that..."
            className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
            required
          />
        </div>

        {/* Sentence 3: Implication / Resolution */}
        <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="implication"
              className="text-sm font-semibold text-stone-200 flex items-center space-x-2"
            >
              <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-semibold text-xs flex items-center justify-center">
                3
              </span>
              <span>Sentence 3: The Big Takeaway</span>
            </label>
            <span className="text-xs text-stone-400 flex items-center space-x-1">
              <HelpCircle className="w-3 h-3" />
              <span>Why does this matter, or what does it teach us?</span>
            </span>
          </div>
          <textarea
            id="implication"
            rows={2}
            value={implication}
            onChange={(e) => setImplication(e.target.value)}
            placeholder="e.g. As a result, we learn that..."
            className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full py-3.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-all shadow-xl shadow-amber-700/20 flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <span>Generating Reading Report...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Reading & View Report</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
