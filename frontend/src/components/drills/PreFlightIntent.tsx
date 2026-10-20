import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import type { CorpusPassage } from '../../types';
import { api } from '../../lib/api';
import { Sparkles, ArrowRight, ArrowLeft, Target, Compass, Zap, Flame } from 'lucide-react';

interface PreFlightIntentProps {
  passage: CorpusPassage;
  onStartReading: (targetQuestion: string, lens: string) => void;
  onBackToLibrary?: () => void;
}

const LENSES = [
  {
    id: 'bottleneck_tradeoff',
    label: 'Problems & Solutions',
    desc: 'Look for constraints, limits, challenges, or trade-offs.',
    icon: Flame,
    color: 'text-amber-300 border-amber-500/35 bg-amber-500/15',
  },
  {
    id: 'mechanism_invariant',
    label: 'How It Works',
    desc: 'Follow the steps, causes, effects, and science rules.',
    icon: Zap,
    color: 'text-teal-300 border-teal-500/35 bg-teal-500/15',
  },
  {
    id: 'core_claim',
    label: 'Main Idea & Arguments',
    desc: 'Identify the central message, thesis, and evidence.',
    icon: Compass,
    color: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/15',
  },
  {
    id: 'custom',
    label: 'My Own Question',
    desc: 'Formulate your own question to answer as you read.',
    icon: Target,
    color: 'text-orange-300 border-orange-500/35 bg-orange-500/15',
  },
];

function transitionStage(updateDOM: () => void, direction: 'forward' | 'backward') {
  const doc = typeof document !== 'undefined' ? (document as any) : null;
  if (!doc || typeof doc.startViewTransition !== 'function') {
    updateDOM();
    return;
  }

  try {
    doc.startViewTransition({
      update: () => {
        flushSync(updateDOM);
      },
      types: [direction],
    });
  } catch {
    updateDOM();
  }
}

export const PreFlightIntent: React.FC<PreFlightIntentProps> = ({
  passage,
  onStartReading,
  onBackToLibrary,
}) => {
  const [step, setStep] = useState<'lens' | 'question'>('lens');
  const [selectedLens, setSelectedLens] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionSource, setSuggestionSource] = useState<string | null>(null);

  const activeLensObj = LENSES.find((l) => l.id === selectedLens) ?? LENSES[0];

  const handleSelectLens = (lensId: string) => {
    transitionStage(() => {
      setSelectedLens(lensId);
      setStep('question');
    }, 'forward');
  };

  const handleBackToLens = () => {
    transitionStage(() => {
      setSelectedLens(null);
      setStep('lens');
    }, 'backward');
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await api.suggestIntent(passage.id, selectedLens ?? 'core_claim');
      setQuestion(res.suggested_question);
      setSuggestionSource(res.source === 'offline_heuristic' ? 'Reading Guide' : 'AI Reading Coach');
    } catch {
      setQuestion('What is the main idea and key takeaway of this passage?');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedLens) return;
    onStartReading(question.trim(), selectedLens);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 space-y-6">
      {/* Top Bar: Back to Library & Passage Title Only */}
      <div className="space-y-3 border-b border-stone-800/80 pb-5">
        {onBackToLibrary && (
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-stone-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Library</span>
          </button>
        )}

        <h2 className="text-2xl sm:text-3xl font-bold text-stone-100 tracking-tight font-serif">
          {passage.title}
        </h2>
      </div>

      {/* Stage 1: Focus Lens Selection */}
      {step === 'lens' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-stone-200">
              1. Choose Your Focus Lens
            </label>
            <span className="text-xs text-stone-400">Step 1 of 2</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LENSES.map((lens) => {
              const Icon = lens.icon;
              const isSelected = selectedLens === lens.id;
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => handleSelectLens(lens.id)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? `${lens.color} ring-1 ring-amber-200/20 shadow-lg`
                      : 'bg-stone-900/40 border-stone-800/80 hover:bg-stone-900 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="font-semibold text-sm text-stone-100">{lens.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                  <p className="text-xs text-stone-400 leading-snug">{lens.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage 2: Guiding Question Formulation */}
      {step === 'question' && (
        <form onSubmit={handleStart} className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-stone-200">
                2. Your Guiding Question
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${activeLensObj.color}`}
              >
                {activeLensObj.label}
              </span>
            </div>
            <span className="text-xs text-stone-400">Step 2 of 2</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="intent-question" className="text-xs text-stone-400">
                Write a question to guide your attention, or ask the coach to suggest one:
              </label>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isSuggesting}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 disabled:opacity-50 transition-colors font-semibold cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSuggesting ? 'Formulating...' : 'Suggest Question'}</span>
              </button>
            </div>

            <textarea
              id="intent-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the central puzzle or question the author is trying to answer?"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm leading-relaxed"
              required
            />

            {suggestionSource && (
              <p className="text-xs font-medium text-stone-400 mt-1.5 flex items-center space-x-1">
                <span>Suggested by:</span>
                <span className="text-amber-300">{suggestionSource}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleBackToLens}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-stone-700/80 bg-stone-900/60 hover:bg-stone-800 text-stone-200 font-medium text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Focus Lens</span>
            </button>

            <button
              type="submit"
              disabled={!question.trim()}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-all shadow-xl shadow-amber-700/20 flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Start Reading</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

