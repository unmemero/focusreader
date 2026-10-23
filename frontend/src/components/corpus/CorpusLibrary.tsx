import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { CorpusPassage } from '../../types';
import { api } from '../../lib/api';
import {
  getPassageDifficulty,
  formatTopicLabel,
  type DifficultyTier,
} from '../../lib/difficulty';
import { CorpusIngestion } from '../ingestion/CorpusIngestion';
import {
  Shuffle,
  PlusCircle,
  Filter,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Gauge,
} from 'lucide-react';

interface CorpusLibraryProps {
  onSelectPassage: (passageId: string) => void;
  onNavigateIngest?: () => void;
  onBack?: () => void;
}

const DOMAINS = [
  { id: 'all', label: 'All Domains' },
  { id: 'general_humanities', label: 'Humanities' },
  { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'computer_science', label: 'Computer Science' },
  { id: 'biology', label: 'Biology' },
];

const DIFFICULTIES: { id: 'all' | DifficultyTier; label: string }[] = [
  { id: 'all', label: 'All Levels' },
  { id: 'Easy', label: 'Easy' },
  { id: 'Medium', label: 'Medium' },
  { id: 'Hard', label: 'Hard' },
];

type SortOption = 'alpha_asc' | 'alpha_desc' | 'diff_asc' | 'diff_desc';

const PAGE_SIZE = 6;

export const CorpusLibrary: React.FC<CorpusLibraryProps> = ({
  onSelectPassage,
  onNavigateIngest,
  onBack,
}) => {
  const [passages, setPassages] = useState<CorpusPassage[]>([]);
  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | DifficultyTier>('all');
  const [sortBy, setSortBy] = useState<SortOption>('alpha_asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const registerCustomDomains = useCallback((items: CorpusPassage[]) => {
    const presetIds = new Set(DOMAINS.map((d) => d.id));
    setCustomDomains((prev) => {
      const next = new Set(prev);
      for (const p of items) {
        if (p.domain && !presetIds.has(p.domain)) {
          next.add(p.domain);
        }
      }
      return Array.from(next);
    });
  }, []);

  const availableDomains = useMemo(() => {
    return [
      ...DOMAINS,
      ...customDomains.map((id) => ({
        id,
        label: formatTopicLabel(id),
      })),
    ];
  }, [customDomains]);

  const fetchPassages = useCallback(
    (domain: string) => {
      setIsLoading(true);
      api
        .getPassages(domain === 'all' ? undefined : domain)
        .then((data) => {
          setPassages(data);
          registerCustomDomains(data);
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [registerCustomDomains]
  );

  useEffect(() => {
    let isMounted = true;
    api
      .getPassages(selectedDomain === 'all' ? undefined : selectedDomain)
      .then((data) => {
        if (isMounted) {
          setPassages(data);
          registerCustomDomains(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDomain, registerCustomDomains]);

  // Manage native <dialog> modal open/close & light-dismiss fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isAddModalOpen) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else {
      if (typeof dialog.close === 'function') {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleDialogClose = () => {
      setIsAddModalOpen(false);
    };
    dialog.addEventListener('close', handleDialogClose);

    // Fallback for browsers without native <dialog closedby="any"> support
    let handleBackdropClick: ((event: MouseEvent) => void) | null = null;
    if (
      typeof HTMLDialogElement !== 'undefined' &&
      !('closedBy' in HTMLDialogElement.prototype)
    ) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleDialogClose);
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, []);

  const openAddModal = () => {
    setIsAddModalOpen(true);
    onNavigateIngest?.();
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredAndSortedPassages = useMemo(() => {
    const withDiff = passages.map((passage) => ({
      passage,
      difficulty: getPassageDifficulty(passage),
    }));

    const filtered =
      selectedDifficulty === 'all'
        ? withDiff
        : withDiff.filter((item) => item.difficulty.tier === selectedDifficulty);

    return [...filtered].sort((a, b) => {
      if (sortBy === 'alpha_asc') {
        return a.passage.title.localeCompare(b.passage.title);
      }
      if (sortBy === 'alpha_desc') {
        return b.passage.title.localeCompare(a.passage.title);
      }
      if (sortBy === 'diff_asc') {
        return (
          a.difficulty.score - b.difficulty.score ||
          a.passage.title.localeCompare(b.passage.title)
        );
      }
      return (
        b.difficulty.score - a.difficulty.score ||
        a.passage.title.localeCompare(b.passage.title)
      );
    });
  }, [passages, selectedDifficulty, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedPassages.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPassages = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredAndSortedPassages.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredAndSortedPassages, safeCurrentPage]);

  const handleRandomSelect = async () => {
    try {
      if (filteredAndSortedPassages.length > 0 && selectedDifficulty !== 'all') {
        const randomIndex = Math.floor(Math.random() * filteredAndSortedPassages.length);
        onSelectPassage(filteredAndSortedPassages[randomIndex].passage.id);
        return;
      }
      const random = await api.getRandomPassage(
        selectedDomain === 'all' ? undefined : selectedDomain
      );
      onSelectPassage(random.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-800/80 pb-5">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Reading Studio"
              title="Back to Reading Studio"
              className="p-2 rounded-xl border border-stone-700/80 bg-stone-900/70 hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-100 tracking-tight font-serif">
              Articles & Stories
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Choose a reading passage to practice in the studio
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleRandomSelect}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-stone-700/80 bg-stone-900/70 hover:bg-stone-800 text-stone-200 text-xs font-medium transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>Random Reading</span>
          </button>

          <button
            onClick={openAddModal}
            data-tour="add-reading-btn"
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-semibold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Reading</span>
          </button>
        </div>
      </div>

      {/* Single-Line Domain, Level & Order Selectors */}
      <div data-tour="library-filters" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Domain Selector */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <label htmlFor="library-domain" className="text-xs text-stone-400 font-medium">
              Domain:
            </label>
            <select
              id="library-domain"
              value={selectedDomain}
              onChange={(e) => {
                const nextDomain = e.target.value;
                if (selectedDomain !== nextDomain) {
                  setSelectedDomain(nextDomain);
                  setCurrentPage(1);
                  setIsLoading(true);
                }
              }}
              className="bg-stone-900 border border-stone-700/80 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {availableDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.label}
                </option>
              ))}
            </select>
          </div>

          {/* Level Selector */}
          <div className="flex items-center space-x-2">
            <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <label htmlFor="library-level" className="text-xs text-stone-400 font-medium">
              Level:
            </label>
            <select
              id="library-level"
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value as 'all' | DifficultyTier);
                setCurrentPage(1);
              }}
              className="bg-stone-900 border border-stone-700/80 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {DIFFICULTIES.map((diff) => (
                <option key={diff.id} value={diff.id}>
                  {diff.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort Order Selector */}
        <div className="flex items-center space-x-2 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <label htmlFor="library-sort" className="text-xs text-stone-400 font-medium">
            Order:
          </label>
          <select
            id="library-sort"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            className="bg-stone-900 border border-stone-700/80 rounded-lg px-2.5 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="alpha_asc">Alphabetical (A–Z)</option>
            <option value="alpha_desc">Alphabetical (Z–A)</option>
            <option value="diff_asc">Difficulty (Easy → Hard)</option>
            <option value="diff_desc">Difficulty (Hard → Easy)</option>
          </select>
        </div>
      </div>

      {/* Passages Toggleable List */}
      {isLoading ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          Loading library passages...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-950/30 text-rose-200 text-xs">
          {error}
        </div>
      ) : filteredAndSortedPassages.length === 0 ? (
        <div className="text-center py-16 bg-stone-900/30 border border-stone-800 rounded-2xl p-8">
          <Layers className="w-8 h-8 text-stone-400 mx-auto mb-3" />
          <p className="text-sm text-stone-300 font-medium">
            No passages found matching your filters.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-semibold inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add New Reading</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedPassages.map(({ passage, difficulty }) => {
            const isExpanded = expandedIds.has(passage.id);
            const topicLabel = formatTopicLabel(passage.domain);

            return (
              <div
                key={passage.id}
                className="bg-stone-900/50 border border-stone-800/90 hover:border-stone-700/90 rounded-xl transition-all"
              >
                {/* Row Header */}
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div
                    onClick={() => toggleExpanded(passage.id)}
                    className="flex items-start sm:items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <button
                      type="button"
                      data-tour="passage-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(passage.id);
                      }}
                      aria-expanded={isExpanded}
                      aria-label={`Toggle details for ${passage.title}`}
                      className="p-1 mt-0.5 sm:mt-0 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition-colors shrink-0 cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-amber-400' : ''
                        }`}
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base font-semibold text-stone-100 hover:text-amber-200 transition-colors tracking-tight truncate">
                          {passage.title}
                        </h3>

                        {!isExpanded && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-stone-700/80 bg-stone-800/80 text-stone-300 shrink-0">
                            {topicLabel}
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <p className="text-xs text-stone-400 font-serif italic mt-0.5">
                          {passage.source_attribution}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-tour="start-reading-btn"
                    onClick={() => onSelectPassage(passage.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm shrink-0"
                  >
                    <span>Start Reading</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded Details (On state) */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-stone-800/70 space-y-2.5 bg-stone-950/35 rounded-b-xl">
                    {/* Tags Row (Topic & Difficulty in regular case) */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="px-2.5 py-0.5 rounded-full border border-stone-700/80 bg-stone-800/80 text-stone-200">
                        {topicLabel}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full border ${difficulty.badgeClass}`}
                      >
                        {difficulty.tier}
                      </span>
                    </div>

                    {/* Word Count below the tags */}
                    <div className="text-xs text-stone-400 font-medium">
                      {passage.word_count} words
                    </div>

                    {/* Excerpt Summary / Preview */}
                    <p className="text-sm text-stone-300 line-clamp-3 leading-relaxed font-serif">
                      {passage.passage_text}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !error && filteredAndSortedPassages.length > 0 && (
        <nav
          aria-label="Library pagination"
          className="flex items-center justify-center gap-2 pt-2"
        >
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safeCurrentPage <= 1}
            aria-label="Previous page"
            className="px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 text-stone-300 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
              const isCurrent = page === safeCurrentPage;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-600 text-stone-950 font-semibold shadow-sm'
                      : 'border border-stone-800 bg-stone-900/40 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safeCurrentPage >= totalPages}
            aria-label="Next page"
            className="px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 text-stone-300 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}

      {/* Add Reading Modal (<dialog>) */}
      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby="add-reading-modal-title"
        className="w-full max-w-2xl bg-transparent p-4 m-auto border-0 outline-none backdrop:bg-black/75"
      >
        <CorpusIngestion
          initialDomain={selectedDomain}
          onBackToLibrary={closeAddModal}
          onSuccess={(res) => {
            if (res?.passages) {
              registerCustomDomains(res.passages);
            }
            closeAddModal();
            fetchPassages(selectedDomain);
          }}
        />
      </dialog>
    </div>
  );
};
