import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { CorpusPassage } from '../../types';
import { EyeOff, Flag, ArrowRight } from 'lucide-react';

interface IndexCardPacerProps {
  passage: CorpusPassage;
  targetQuestion: string;
  driftCount: number;
  onRecordDrift: (elapsedSeconds: number, lineNumber?: number) => void;
  onFinishReading: (elapsedSeconds: number) => void;
}

export const IndexCardPacer: React.FC<IndexCardPacerProps> = ({
  passage,
  driftCount,
  onRecordDrift,
  onFinishReading,
}) => {
  const [activeUnitIndex, setActiveUnitIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isDriftFlash, setIsDriftFlash] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Split passage into readable units (sentences or paragraph chunks)
  const units = useMemo(() => {
    const matches = passage.passage_text
      .split(/(?<=[.?!]['"’”)]?)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return matches.length > 0 ? matches : [passage.passage_text];
  }, [passage.passage_text]);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (activeLineRef.current && typeof activeLineRef.current.scrollIntoView === 'function') {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeUnitIndex]);

  // Trigger drift with visual flash
  const triggerDrift = useCallback(() => {
    setIsDriftFlash(true);
    setTimeout(() => setIsDriftFlash(false), 300);
    onRecordDrift(elapsedSeconds, activeUnitIndex + 1);
  }, [elapsedSeconds, activeUnitIndex, onRecordDrift]);

  // Keyboard navigation for pacer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (activeUnitIndex >= units.length - 1) {
          onFinishReading(elapsedSeconds);
        } else {
          setActiveUnitIndex((prev) => Math.min(units.length - 1, prev + 1));
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        triggerDrift();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onFinishReading(elapsedSeconds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeUnitIndex, units.length, triggerDrift, onFinishReading, elapsedSeconds]);

  const progressPct = Math.round(((activeUnitIndex + 1) / units.length) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto py-6" ref={containerRef}>
      {/* Sticky Pacer Telemetry Bar */}
      <div className="sticky top-4 z-30 bg-stone-900/90 border border-stone-800 rounded-2xl p-4 mb-6 backdrop-blur-md shadow-xl transition-colors">
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 font-medium">Elapsed Time</span>
              <span className="text-stone-100 font-semibold">
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] text-stone-400 font-medium">Focus Breaks</span>
              <span
                className={`font-semibold flex items-center space-x-1 transition-colors ${
                  isDriftFlash || driftCount > 0 ? 'text-amber-400' : 'text-stone-400'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>{driftCount}</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => onFinishReading(elapsedSeconds)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <span>Finished Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-800 h-1 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-amber-500 h-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Shrouded Reading Passage Viewport */}
      <div className="bg-stone-900/40 border border-stone-800/70 rounded-2xl p-8 sm:p-12 space-y-6">
        <div className="border-b border-stone-800/80 pb-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-100 tracking-tight font-serif">
            {passage.title}
          </h1>
          <p className="text-xs text-stone-400 font-serif italic mt-1">
            {passage.source_attribution}
          </p>
        </div>

        {/* Content Units with Index Card Shroud */}
        <div className="space-y-4 text-base sm:text-lg leading-relaxed font-serif tracking-normal text-stone-200 selection:bg-amber-500/30">
          {units.map((unit, idx) => {
            const isPast = idx < activeUnitIndex;
            const isActive = idx === activeUnitIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => setActiveUnitIndex(idx)}
                className={`transition-all duration-200 rounded-lg p-2.5 cursor-pointer relative ${
                  isActive
                    ? 'bg-amber-950/35 border-l-4 border-amber-400 text-stone-100 font-medium shadow-sm'
                    : isPast
                    ? 'opacity-25 filter blur-[0.3px] select-none text-stone-400 hover:opacity-50'
                    : 'opacity-70 text-stone-300 hover:opacity-100'
                }`}
              >
                {/* Physical index card top barrier effect on past items */}
                {isPast && (
                  <div className="absolute inset-0 bg-stone-950/40 rounded pointer-events-none" />
                )}
                <span>{unit}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pacer Navigation Footer & Keyboard Shortcuts */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-stone-900/50 border border-stone-800 text-xs font-medium text-stone-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-200">
              ↓
            </kbd>{' '}
            <span>/</span>{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-200">
              J
            </kbd>
            <span>Next Line</span>
          </span>

          <span className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-200">
              Space
            </kbd>
            <span>Lost My Place</span>
          </span>

          <span className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-200">
              Ctrl+Enter
            </kbd>
            <span>Finish</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={triggerDrift}
            className="px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Lost My Place (Focus Break)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
