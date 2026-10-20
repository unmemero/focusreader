import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getPassageDifficulty, type DifficultyTier } from '../../lib/difficulty';
import {
  X,
  CheckCircle,
  UploadCloud,
  AlertCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { IngestResponse, SuggestPassageResponse } from '../../types';

interface CorpusIngestionProps {
  onBackToLibrary: () => void;
  onSuccess: (response: IngestResponse) => void;
  initialDomain?: string;
  isLlmConnected?: boolean;
}

const PRESET_DOMAIN_IDS = [
  'general_humanities',
  'biology',
  'physics',
  'chemistry',
  'computer_science',
];

const DOMAINS = [
  { id: 'general_humanities', label: 'Humanities & Literature' },
  { id: 'biology', label: 'Biology & Nature' },
  { id: 'physics', label: 'Physics & Astronomy' },
  { id: 'chemistry', label: 'Chemistry & Matter' },
  { id: 'computer_science', label: 'Computer Science & Logic' },
  { id: 'other', label: 'Other (Custom Topic)...' },
];

const DIFFICULTY_LEVELS: DifficultyTier[] = ['Easy', 'Medium', 'Hard'];

const DOMAIN_EXAMPLES: Record<string, { title: string; author: string }> = {
  general_humanities: {
    title: 'e.g. Simplicity and Deliberate Living',
    author: 'e.g. Henry David Thoreau, Walden (1854)',
  },
  biology: {
    title: 'e.g. How Honeybees Map Distance and Direction',
    author: 'e.g. Karl von Frisch, The Dancing Bees (1953)',
  },
  physics: {
    title: 'e.g. Why the Daytime Sky Is Blue and Sunsets Are Red',
    author: 'e.g. Lord Rayleigh, Philosophical Magazine (1871)',
  },
  chemistry: {
    title: 'e.g. The Chemical History of a Candle',
    author: 'e.g. Michael Faraday, Royal Institution Lectures (1861)',
  },
  computer_science: {
    title: 'e.g. Calculating Engines and Eliminating Human Error',
    author: 'e.g. Charles Babbage, Life of a Philosopher (1864)',
  },
  other: {
    title: 'e.g. Thinking, Fast and Slow: Two Systems of Thought',
    author: 'e.g. Daniel Kahneman (2011)',
  },
};

export const CorpusIngestion: React.FC<CorpusIngestionProps> = ({
  onBackToLibrary,
  onSuccess,
  initialDomain,
  isLlmConnected: initialLlmConnected,
}) => {
  const isInitialPreset =
    !initialDomain || initialDomain === 'all' || PRESET_DOMAIN_IDS.includes(initialDomain);
  const defaultDomain =
    initialDomain && initialDomain !== 'all'
      ? isInitialPreset
        ? initialDomain
        : 'other'
      : 'general_humanities';

  const [title, setTitle] = useState<string>('');
  const [domain, setDomain] = useState<string>(defaultDomain);
  const [customDomain, setCustomDomain] = useState<string>(
    !isInitialPreset && initialDomain ? initialDomain.replace(/_/g, ' ') : ''
  );
  const [difficulty, setDifficulty] = useState<DifficultyTier>('Medium');
  const [hasManualDifficulty, setHasManualDifficulty] = useState<boolean>(false);
  const [sourceAttribution, setSourceAttribution] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AI Non-Generative Passage Suggestion state
  const [isAiConnected, setIsAiConnected] = useState<boolean>(Boolean(initialLlmConnected));
  const [promptParameters, setPromptParameters] = useState<string>('');
  const [isSuggestingPassage, setIsSuggestingPassage] = useState<boolean>(false);
  const [lastSuggestion, setLastSuggestion] = useState<SuggestPassageResponse | null>(null);
  const [suggestedTitlesHistory, setSuggestedTitlesHistory] = useState<string[]>([]);

  useEffect(() => {
    if (initialDomain && initialDomain !== 'all') {
      if (PRESET_DOMAIN_IDS.includes(initialDomain)) {
        setDomain(initialDomain);
      } else {
        setDomain('other');
        setCustomDomain(initialDomain.replace(/_/g, ' '));
      }
    }
  }, [initialDomain]);

  useEffect(() => {
    if (typeof initialLlmConnected === 'boolean') {
      setIsAiConnected(initialLlmConnected);
    }
    let isMounted = true;
    const maybeConfig = api.getConfig?.();
    if (maybeConfig && typeof maybeConfig.then === 'function') {
      maybeConfig
        .then((cfg) => {
          if (isMounted && cfg) {
            setIsAiConnected(Boolean(cfg.is_llm_connected));
          }
        })
        .catch(() => {
          // Ignore offline config check errors
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialLlmConnected]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Compute live difficulty badge styling
  const liveDifficultyInfo = getPassageDifficulty({
    passage_text: text,
    lexical_density_score:
      difficulty === 'Easy' ? 0.35 : difficulty === 'Hard' ? 0.75 : 0.55,
  });

  const activePlaceholders =
    DOMAIN_EXAMPLES[domain] || DOMAIN_EXAMPLES.general_humanities;

  const effectiveDomain = domain === 'other' ? customDomain.trim() : domain;

  const handleTextChange = (newText: string) => {
    setText(newText);
    if (!hasManualDifficulty && newText.trim().length > 0) {
      const detected = getPassageDifficulty({
        passage_text: newText,
        lexical_density_score: null,
      });
      setDifficulty(detected.tier);
    }
  };

  const handleSuggestPassage = async () => {
    if (isSuggestingPassage || !api.suggestPassage) return;
    setIsSuggestingPassage(true);
    setError(null);
    try {
      const combinedPrompt =
        domain === 'other' && customDomain.trim()
          ? [customDomain.trim(), promptParameters.trim()].filter(Boolean).join(' — ')
          : promptParameters.trim();
      const suggestion = await api.suggestPassage({
        domain: domain === 'other' ? undefined : domain,
        difficulty,
        prompt_parameters: combinedPrompt || undefined,
        exclude_titles: suggestedTitlesHistory,
      });
      setTitle(suggestion.title);
      if (PRESET_DOMAIN_IDS.includes(suggestion.domain)) {
        setDomain(suggestion.domain);
      } else {
        setDomain('other');
        setCustomDomain(suggestion.domain.replace(/_/g, ' '));
      }
      setDifficulty(suggestion.difficulty);
      setHasManualDifficulty(true);
      setSourceAttribution(suggestion.source_attribution);
      setText(suggestion.text);
      setLastSuggestion(suggestion);
      setSuggestedTitlesHistory((prev) =>
        prev.includes(suggestion.title) ? prev : [...prev, suggestion.title]
      );
    } catch (err: any) {
      setError(err.message || 'Could not fetch a passage suggestion.');
    } finally {
      setIsSuggestingPassage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !title.trim() ||
      !text.trim() ||
      !sourceAttribution.trim() ||
      !effectiveDomain ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.ingestCorpus({
        title: title.trim(),
        domain: effectiveDomain,
        source_attribution: sourceAttribution.trim(),
        text: text.trim(),
        difficulty,
      });
      setTitle('');
      setSourceAttribution('');
      setText('');
      if (domain === 'other') {
        setCustomDomain('');
      }
      setHasManualDifficulty(false);
      setLastSuggestion(null);
      onSuccess(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-stone-100 max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-medium text-xs mb-1">
            <UploadCloud className="w-4 h-4" />
            <span>Add a Reading Passage</span>
          </div>
          <h2
            id="add-reading-modal-title"
            className="text-xl sm:text-2xl font-bold text-stone-100 tracking-tight font-serif"
          >
            Add a Reading Passage
          </h2>
        </div>

        <button
          type="button"
          onClick={onBackToLibrary}
          aria-label="Close modal"
          className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* AI Passage Finder (shown when AI is connected) */}
      {isAiConnected && (
        <div className="mb-5 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>AI Passage Finder</span>
              </div>
              <p className="text-xs text-stone-300">
                Pick a topic or vibe and let AI pull a real passage for you.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuggestPassage}
              disabled={isSuggestingPassage}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-xs transition-all flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {isSuggestingPassage
                  ? 'Finding...'
                  : lastSuggestion
                  ? 'Try Another'
                  : 'Suggest Passage'}
              </span>
            </button>
          </div>

          <div>
            <label
              htmlFor="ai-prompt-parameters"
              className="block text-[11px] font-medium text-stone-400 mb-1"
            >
              Topic or prompt (optional)
            </label>
            <input
              id="ai-prompt-parameters"
              name="prompt_parameters"
              type="text"
              value={promptParameters}
              onChange={(e) => setPromptParameters(e.target.value)}
              placeholder="e.g. Stoic philosophy, black holes, how bees navigate..."
              className="w-full bg-stone-950/90 border border-amber-500/25 rounded-lg px-3 py-1.5 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 text-xs"
            />
          </div>

          {lastSuggestion && (
            <div
              aria-live="polite"
              className="pt-2 border-t border-amber-500/20 text-xs text-stone-300 flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-center gap-2 font-medium text-amber-200">
                <span>{lastSuggestion.selected_sections}</span>
                <span>•</span>
                <span>{lastSuggestion.word_count} words</span>
                <span>•</span>
                <span>{lastSuggestion.difficulty}</span>
              </div>
              {lastSuggestion.classified_topics &&
                lastSuggestion.classified_topics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {lastSuggestion.classified_topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-md bg-stone-900/90 border border-stone-700 text-[11px] text-amber-200"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 p-4 rounded-xl border border-rose-500/25 bg-rose-950/30 text-rose-200 text-xs font-medium flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="passage-title"
            className="block text-xs font-semibold text-stone-300 mb-1.5"
          >
            Title
          </label>
          <input
            id="passage-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={activePlaceholders.title}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="passage-domain"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Subject Area
            </label>
            <select
              id="passage-domain"
              name="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
            >
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="passage-difficulty"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Difficulty
            </label>
            <select
              id="passage-difficulty"
              name="difficulty"
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value as DifficultyTier);
                setHasManualDifficulty(true);
              }}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
            >
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="passage-attribution"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Author / Source
            </label>
            <input
              id="passage-attribution"
              name="source_attribution"
              type="text"
              value={sourceAttribution}
              onChange={(e) => setSourceAttribution(e.target.value)}
              placeholder={activePlaceholders.author}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              required
            />
          </div>
        </div>

        {domain === 'other' && (
          <div>
            <label
              htmlFor="custom-domain"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Custom Topic
            </label>
            <input
              id="custom-domain"
              name="custom_domain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="e.g. Psychology, Economics, Art History, Music..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              required
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="passage-text" className="text-xs font-semibold text-stone-300">
              Passage Text
            </label>
            <div className="flex items-center space-x-2 text-xs font-medium">
              <span
                className={`px-2 py-0.5 rounded-full border text-[11px] ${liveDifficultyInfo.badgeClass}`}
              >
                {difficulty}
              </span>
              <span className="text-stone-400">{wordCount} words</span>
            </div>
          </div>
          <textarea
            id="passage-text"
            name="text"
            rows={7}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Paste an essay, story, or article excerpt here..."
            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm leading-relaxed font-serif"
            required
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onBackToLibrary}
            className="px-4 py-2.5 rounded-xl border border-stone-700/80 bg-stone-900 hover:bg-stone-800 text-stone-300 font-medium text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              !title.trim() ||
              !text.trim() ||
              !sourceAttribution.trim() ||
              !effectiveDomain ||
              isSubmitting
            }
            className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-all shadow-lg shadow-amber-700/20 flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <span>Preparing Reading Sections...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Add Reading Passage</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
