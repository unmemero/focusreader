import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface TourStep {
  id: string;
  targetSelector: string;
  secondarySelector?: string;
  title: string;
  description: string;
  example?: string;
  actionHint?: string;
  targetTab?: 'drill' | 'analytics' | 'settings';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome_choose',
    targetSelector: '[data-tour="choose-reading-btn"]',
    title: 'Choose a Reading Passage',
    description: 'Welcome to FocusReader! Practice authentic historical, scientific, and literature excerpts designed to build sustained focus, speed, and deep comprehension.',
    actionHint: 'Click "Choose a Reading Passage" to open the library.',
    targetTab: 'drill',
  },
  {
    id: 'library_filters',
    targetSelector: '[data-tour="library-filters"]',
    title: 'Filters & Sorting',
    description: 'Filter your readings by subject domain (Humanities, Physics, Computer Science, Biology) and Difficulty level (Easy, Medium, Hard), or sort alphabetically and by complexity.',
    actionHint: 'Use the selectors to customize your reading selection.',
    targetTab: 'drill',
  },
  {
    id: 'library_toggle',
    targetSelector: '[data-tour="passage-toggle-btn"]',
    title: 'Inspect Passage Details',
    description: 'Click any article row or toggle arrow to expand its details: see word count, difficulty tier, source excerpt, and a summary of the passage.',
    actionHint: 'Toggle passage rows to preview details before reading.',
    targetTab: 'drill',
  },
  {
    id: 'library_add',
    targetSelector: '[data-tour="add-reading-btn"]',
    title: 'Add Custom Reading',
    description: 'Bring your own articles, textbook excerpts, or classroom readings into FocusReader. Paste your text to generate customized focus drills.',
    actionHint: 'Click "Add Reading" anytime you want to ingest custom texts.',
    targetTab: 'drill',
  },
  {
    id: 'library_select',
    targetSelector: '[data-tour="start-reading-btn"]',
    title: 'Select a Reading',
    description: 'Select an article to begin your guided drill. We will set up your cognitive focus lens and guiding question next.',
    actionHint: 'Click "Start Reading" on a passage to enter the studio.',
    targetTab: 'drill',
  },
  {
    id: 'intent_lens',
    targetSelector: '[data-tour="focus-lens-selector"]',
    title: 'Select a Focus Lens',
    description: 'Cognitive priming prepares your working memory. Choose a focus lens (like Bottlenecks & Tradeoffs, or Chronology & Logic) to train your brain on what structural patterns to notice.',
    actionHint: 'Choose a focus lens to frame your reading inquiry.',
    targetTab: 'drill',
  },
  {
    id: 'intent_question',
    targetSelector: '[data-tour="guiding-question-box"]',
    title: 'Guiding Question & AI Suggestion',
    description: 'Formulate the guiding inquiry you want to answer after reading. You can write your own question or click the AI Sparkle button to generate a targeted inquiry grounded in the text.',
    actionHint: 'Type your guiding question or click the sparkle button.',
    targetTab: 'drill',
  },
  {
    id: 'intent_start',
    targetSelector: '[data-tour="begin-reading-drill-btn"]',
    title: 'Begin Reading Drill',
    description: 'Once your focus lens and guiding question are primed, launch into the paced reading screen.',
    actionHint: 'Click "Start Reading Drill" to launch the pacer.',
    targetTab: 'drill',
  },
  {
    id: 'pacer_advance',
    targetSelector: '[data-tour="pacer-passage-viewport"]',
    title: 'Move One Line at a Time',
    description: 'The index-card pacer shrouds the text to prevent regression and build steady pacing. Press ↓ on your keyboard or click outside a paragraph to advance to the next line. You can also click directly on any paragraph to select it.',
    actionHint: 'Press ↓ or click outside a paragraph to advance.',
    targetTab: 'drill',
  },
  {
    id: 'pacer_drift',
    targetSelector: '[data-tour="pacer-focus-breaks"]',
    title: 'Lost My Place (Focus Break)',
    description: 'Did your attention wander? Press Space anytime your mind drifts. Recording focus breaks trains metacognitive awareness without breaking your flow.',
    actionHint: 'Press Space whenever your mind wanders to track focus breaks.',
    targetTab: 'drill',
  },
  {
    id: 'pacer_finish',
    targetSelector: '[data-tour="pacer-passage-viewport"]',
    title: 'Finishing the Passage',
    description: 'Continue advancing through the text. When you reach the final sentence, press ↓ or press Ctrl+Enter at any time to complete your reading session.',
    actionHint: 'Press ↓ on the last line or Ctrl+Enter to finish reading.',
    targetTab: 'drill',
  },
  {
    id: 'recall_intent',
    targetSelector: '[data-tour="intent-recall-box"]',
    title: 'Quick Intent Recall',
    description: 'Synthesize the answer to your guiding question from working memory without looking back at the text. Note: The countdown timer is purely advisory to encourage prompt recall.',
    actionHint: 'Type your answer in the box to continue.',
    targetTab: 'drill',
  },
  {
    id: 'recall_proceed',
    targetSelector: '[data-tour="proceed-to-summary-btn"]',
    title: 'Proceed to Summary',
    description: 'Once you have typed your intent recall answer, click Proceed to Summary to enter the 3-sentence synthesis debrief.',
    actionHint: 'Click "Proceed to Summary".',
    targetTab: 'drill',
  },
  {
    id: 'debrief_premise',
    targetSelector: '[data-tour="summary-premise-box"]',
    title: '1. The Starting Fact (Premise)',
    description: 'Summarize the initial baseline or starting fact established in the passage.',
    example: 'Example: "Water molecules exist in liquid, gas, or solid form depending on temperature and molecular motion."',
    actionHint: 'Type the baseline premise to advance to the next sentence.',
    targetTab: 'drill',
  },
  {
    id: 'debrief_pivot',
    targetSelector: '[data-tour="summary-pivot-box"]',
    title: '2. The Turning Point (Pivot)',
    description: 'Explain the conflict, mechanism, or critical shift that altered the scenario.',
    example: 'Example: "As thermal energy decreases, attractive intermolecular forces overcome kinetic velocity."',
    actionHint: 'Type the pivot to advance to the final takeaway.',
    targetTab: 'drill',
  },
  {
    id: 'debrief_takeaway',
    targetSelector: '[data-tour="summary-takeaway-box"]',
    title: '3. The Big Takeaway (Implication)',
    description: 'State the essential conclusion or structural insight of the text.',
    example: 'Example: "State transitions are purely mechanical outcomes of kinetic energy balancing intermolecular attraction."',
    actionHint: 'Fill all 3 sentences to complete your summary.',
    targetTab: 'drill',
  },
  {
    id: 'debrief_complete',
    targetSelector: '[data-tour="complete-report-btn"]',
    title: 'Complete Reading Report',
    description: 'With all 3 structural sentences completed, submit your debrief to receive AI coach feedback and metrics.',
    actionHint: 'Click "Complete Reading Report".',
    targetTab: 'drill',
  },
  {
    id: 'results_slides',
    targetSelector: '[data-tour="session-results-slide"]',
    title: 'Slide Presentation Report',
    description: 'Review your session report slide by slide! Slide 1 highlights Reading Pace (WPM) and Focus Streak. Slide 2 scores Clear Expression, Precision, and Deep Understanding. Slide 3 delivers tailored coach tips.',
    actionHint: 'Click "Next" to navigate through the slides.',
    targetTab: 'drill',
  },
  {
    id: 'results_progress',
    targetSelector: '[data-tour="view-my-progress-btn"]',
    secondarySelector: '[data-tour="my-progress-btn"]',
    title: 'Saved Answers & Progress',
    description: 'On the final slide, review your saved answers. Click "View My Progress" here or the Chart icon on the top right at any time to explore your long-term reading data.',
    actionHint: 'Click "View My Progress" to inspect your progress trends.',
    targetTab: 'drill',
  },
  {
    id: 'analytics_view',
    targetSelector: '[data-tour="analytics-dashboard"]',
    title: 'My Progress Dashboard',
    description: 'Track your growth over time! Review your Average Reading Speed (WPM), Mean Time Between Focus Breaks (MTBD), and review past reading sessions with AI coach feedback.',
    actionHint: 'Click "Next" in the guide to explore settings.',
    targetTab: 'analytics',
  },
  {
    id: 'settings_view',
    targetSelector: '[data-tour="settings-view"]',
    title: 'AI Coach Settings',
    description: 'Configure your AI Coach server endpoint (local Ollama, vLLM, or remote), select your preferred model, adjust timeouts, and check connectivity status.',
    actionHint: 'Click "Next" to return to the Reading Studio.',
    targetTab: 'settings',
  },
  {
    id: 'finish_tour',
    targetSelector: '[data-tour="reading-studio-tab"]',
    title: 'Ready to Read!',
    description: "You're all set! Return to the Reading Studio anytime to practice authentic learning texts, build sustained focus, and learn faster.",
    actionHint: 'Click "Finish Tour" to begin your first session.',
    targetTab: 'drill',
  },
];

interface TutorialContextValue {
  isTourOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep;
  totalSteps: number;
  startTour: () => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  advanceIfCurrent: (stepId: string) => void;
}

const STORAGE_KEY = 'focusreader_tutorial_completed';

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export const TutorialProvider: React.FC<{
  children: React.ReactNode;
  onNavigateTab?: (tab: 'drill' | 'corpus' | 'analytics' | 'settings') => void;
  onStepChange?: (step: TourStep) => void;
}> = ({ children, onNavigateTab, onStepChange }) => {
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Auto-launch on first visit
  useEffect(() => {
    try {
      const hasCompleted = localStorage.getItem(STORAGE_KEY);
      if (!hasCompleted) {
        // Small delay to allow elements to mount
        const timer = setTimeout(() => {
          setIsTourOpen(true);
          if (onStepChange && TOUR_STEPS[0]) {
            onStepChange(TOUR_STEPS[0]);
          }
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage errors (e.g. incognito)
    }
  }, [onStepChange]);

  const currentStep = useMemo(() => {
    return TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  }, [currentStepIndex]);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsTourOpen(true);
    if (onStepChange && TOUR_STEPS[0]) {
      onStepChange(TOUR_STEPS[0]);
    } else if (onNavigateTab) {
      onNavigateTab('drill');
    }
  }, [onNavigateTab, onStepChange]);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
      setCurrentStepIndex(safeIndex);
      const targetStep = TOUR_STEPS[safeIndex];
      if (targetStep) {
        if (onStepChange) {
          onStepChange(targetStep);
        } else if (targetStep.targetTab && onNavigateTab) {
          onNavigateTab(targetStep.targetTab);
        }
      }
    },
    [onNavigateTab, onStepChange]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex >= TOUR_STEPS.length - 1) {
      closeTour();
      if (onNavigateTab) {
        onNavigateTab('drill');
      }
    } else {
      goToStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, closeTour, goToStep, onNavigateTab]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  const advanceIfCurrent = useCallback(
    (stepId: string) => {
      if (isTourOpen && currentStep.id === stepId) {
        nextStep();
      }
    },
    [isTourOpen, currentStep.id, nextStep]
  );

  return (
    <TutorialContext.Provider
      value={{
        isTourOpen,
        currentStepIndex,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        startTour,
        closeTour,
        nextStep,
        prevStep,
        goToStep,
        advanceIfCurrent,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

const defaultTutorialContext: TutorialContextValue = {
  isTourOpen: false,
  currentStepIndex: 0,
  currentStep: TOUR_STEPS[0],
  totalSteps: TOUR_STEPS.length,
  startTour: () => {},
  closeTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  goToStep: () => {},
  advanceIfCurrent: () => {},
};

export const useTutorial = (): TutorialContextValue => {
  const context = useContext(TutorialContext);
  return context || defaultTutorialContext;
};
