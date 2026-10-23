import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTutorial } from '../../context/TutorialContext';
import { ChevronRight, ChevronLeft, X, Sparkles, Lightbulb } from 'lucide-react';

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TutorialOverlay: React.FC = () => {
  const {
    isTourOpen,
    currentStepIndex,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    closeTour,
  } = useTutorial();

  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [secondaryRect, setSecondaryRect] = useState<ElementRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePositions = useCallback(() => {
    if (!isTourOpen || !currentStep) {
      setTargetRect(null);
      setSecondaryRect(null);
      return;
    }

    const elem = document.querySelector(currentStep.targetSelector);
    if (elem) {
      const rect = elem.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      // Scroll into view if out of viewport
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetRect(null);
    }

    if (currentStep.secondarySelector) {
      const secElem = document.querySelector(currentStep.secondarySelector);
      if (secElem) {
        const sRect = secElem.getBoundingClientRect();
        setSecondaryRect({
          top: sRect.top,
          left: sRect.left,
          width: sRect.width,
          height: sRect.height,
        });
      } else {
        setSecondaryRect(null);
      }
    } else {
      setSecondaryRect(null);
    }
  }, [isTourOpen, currentStep]);

  // Keep positions synced on mount, step change, resize and scroll
  useEffect(() => {
    updatePositions();
    const timer = setInterval(updatePositions, 250);
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);

    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [updatePositions]);

  if (!isTourOpen || !currentStep) {
    return null;
  }

  // Calculate tooltip placement relative to targetRect
  const tooltipWidth = 360;
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    width: `${tooltipWidth}px`,
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    // Prefer below unless space is restricted
    if (spaceBelow >= 260 || spaceBelow > spaceAbove) {
      tooltipStyle.top = `${Math.min(window.innerHeight - 270, targetRect.top + targetRect.height + 16)}px`;
    } else {
      tooltipStyle.bottom = `${Math.min(window.innerHeight - 70, window.innerHeight - targetRect.top + 16)}px`;
    }

    // Align horizontally with target, clamping to viewport
    const idealLeft = targetRect.left;
    const maxLeft = window.innerWidth - tooltipWidth - 20;
    tooltipStyle.left = `${Math.max(16, Math.min(idealLeft, maxLeft))}px`;
  } else {
    // Center fallback if target element not yet in DOM
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10000,
      width: `${tooltipWidth}px`,
    };
  }

  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <aside
      aria-label="Interactive Guided Tour"
      className="fixed inset-0 z-[9990] pointer-events-none"
    >
      {/* If targetRect is NOT present, show full screen backdrop */}
      {!targetRect && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs pointer-events-auto transition-opacity duration-300" />
      )}

      {/* If targetRect IS present, create 4 curtains around the spotlighted cut-out to dim everything else and allow interaction with target */}
      {targetRect && (
        <>
          {/* Top curtain */}
          <div
            className="fixed left-0 right-0 top-0 bg-stone-950/80 backdrop-blur-xs pointer-events-auto z-[9991]"
            style={{ height: Math.max(0, targetRect.top - 6) }}
          />
          {/* Bottom curtain */}
          <div
            className="fixed left-0 right-0 bottom-0 bg-stone-950/80 backdrop-blur-xs pointer-events-auto z-[9991]"
            style={{ top: targetRect.top + targetRect.height + 6 }}
          />
          {/* Left curtain */}
          <div
            className="fixed left-0 bg-stone-950/80 backdrop-blur-xs pointer-events-auto z-[9991]"
            style={{
              top: Math.max(0, targetRect.top - 6),
              height: targetRect.height + 12,
              width: Math.max(0, targetRect.left - 6),
            }}
          />
          {/* Right curtain */}
          <div
            className="fixed right-0 bg-stone-950/80 backdrop-blur-xs pointer-events-auto z-[9991]"
            style={{
              top: Math.max(0, targetRect.top - 6),
              height: targetRect.height + 12,
              left: targetRect.left + targetRect.width + 6,
            }}
          />
          {/* Primary Spotlight cutout ring */}
          <div
            data-testid="tour-spotlight-primary"
            style={{
              position: 'fixed',
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
            className="rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-950 pointer-events-none transition-all duration-300 z-[9995] animate-pulse"
          />
        </>
      )}

      {/* Secondary Spotlight cutout ring (e.g. for header progress icon when viewing progress button) */}
      {secondaryRect && (
        <div
          data-testid="tour-spotlight-secondary"
          style={{
            position: 'fixed',
            top: secondaryRect.top - 4,
            left: secondaryRect.left - 4,
            width: secondaryRect.width + 8,
            height: secondaryRect.height + 8,
            boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.9)',
          }}
          className="rounded-lg ring-2 ring-amber-400/80 pointer-events-none z-[9996] animate-pulse"
        />
      )}

      {/* Floating Tour Card Popover */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        className="bg-stone-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-stone-100 flex flex-col space-y-3.5 transition-all duration-200 pointer-events-auto"
      >
        {/* Step Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <button
            type="button"
            onClick={closeTour}
            aria-label="Skip Tour"
            title="Close / Skip Tour"
            className="p-1 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Title & Description */}
        <div>
          <h2 id="tour-step-title" className="text-sm font-bold text-stone-100 font-serif tracking-tight mb-1">
            {currentStep.title}
          </h2>
          <p className="text-xs text-stone-300 leading-relaxed font-sans">
            {currentStep.description}
          </p>
        </div>

        {/* Step Example (if present) */}
        {currentStep.example && (
          <div className="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800/90 text-[11px] text-amber-200/90 italic flex items-start space-x-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{currentStep.example}</span>
          </div>
        )}

        {/* Action Hint Banner */}
        {currentStep.actionHint && (
          <div className="px-2.5 py-1.5 rounded-md bg-amber-950/40 border border-amber-600/30 text-[11px] text-amber-300 font-medium">
            👉 {currentStep.actionHint}
          </div>
        )}

        {/* Controls / Footer */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={closeTour}
            className="text-[11px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer font-medium"
          >
            Skip Tour
          </button>

          <div className="flex items-center space-x-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-2.5 py-1 rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-semibold transition-all shadow-md flex items-center space-x-1 cursor-pointer"
            >
              <span>{isLastStep ? 'Finish Tour' : 'Next'}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
