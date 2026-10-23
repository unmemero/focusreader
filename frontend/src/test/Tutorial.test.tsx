/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { TutorialProvider, useTutorial, TOUR_STEPS } from '../context/TutorialContext';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { Shell } from '../components/layout/Shell';
import { SessionProvider } from '../context/SessionContext';
import { api } from '../lib/api';

describe('Interactive Guided Tutorial (Unit & Integration Tests)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(api, 'getConfig').mockResolvedValue({
      llm_base_url: 'http://localhost:8080',
      llm_model: 'gemma-2-9b-it',
      llm_timeout_seconds: 15,
      is_llm_connected: true,
    });
  });

  it('manually launches tour when Guide Tour button is clicked in header', async () => {
    localStorage.setItem('focusreader_tutorial_completed', 'true');
    const onTabChange = vi.fn();

    await act(async () => {
      render(
        <SessionProvider>
          <TutorialProvider onNavigateTab={onTabChange}>
            <Shell activeTab="drill" onTabChange={onTabChange}>
              <div>
                <button data-tour="choose-reading-btn">Choose a Reading Passage</button>
              </div>
            </Shell>
            <TutorialOverlay />
          </TutorialProvider>
        </SessionProvider>
      );
    });

    // Initially tour is closed because localStorage marked it completed
    expect(screen.queryByLabelText('Interactive Guided Tour')).not.toBeInTheDocument();

    // Click Guide button in header
    const guideBtn = screen.getByRole('button', { name: /Start Guided Tour/i });
    expect(guideBtn).toBeInTheDocument();
    fireEvent.click(guideBtn);

    // Tour overlay should now be open
    expect(screen.getByLabelText('Interactive Guided Tour')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose a Reading Passage' })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of/i)).toBeInTheDocument();
  });

  it('navigates next and back through tutorial steps', async () => {
    const TestComponent = () => {
      const { startTour } = useTutorial();
      return (
        <div>
          <button onClick={startTour}>Start</button>
          <button data-tour="choose-reading-btn">Choose Reading</button>
          <div data-tour="library-filters">Filters</div>
          <div data-tour="passage-toggle-btn">Toggle Details</div>
        </div>
      );
    };

    render(
      <TutorialProvider>
        <TestComponent />
        <TutorialOverlay />
      </TutorialProvider>
    );

    // Start tour
    fireEvent.click(screen.getByText('Start'));

    // Step 1: Choose Reading Passage
    expect(screen.getByText('Choose a Reading Passage')).toBeInTheDocument();

    // Click Next -> Step 2: Filters & Sorting
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Filters & Sorting')).toBeInTheDocument();

    // Click Next -> Step 3: Inspect Passage Details
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Inspect Passage Details')).toBeInTheDocument();

    // Click Back -> Returns to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText('Filters & Sorting')).toBeInTheDocument();
  });

  it('advances step programmatically via advanceIfCurrent', async () => {
    const TestComponent = () => {
      const { startTour, advanceIfCurrent } = useTutorial();
      return (
        <div>
          <button onClick={startTour}>Start</button>
          <button
            data-tour="choose-reading-btn"
            onClick={() => advanceIfCurrent('welcome_choose')}
          >
            Click Choose
          </button>
        </div>
      );
    };

    render(
      <TutorialProvider>
        <TestComponent />
        <TutorialOverlay />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Start'));
    expect(screen.getByText('Choose a Reading Passage')).toBeInTheDocument();

    // Trigger action which calls advanceIfCurrent('welcome_choose')
    fireEvent.click(screen.getByText('Click Choose'));

    // Should automatically advance to step 2 (Filters & Sorting)
    expect(screen.getByText('Filters & Sorting')).toBeInTheDocument();
  });

  it('closes tour and stores completion flag in localStorage on Skip Tour', async () => {
    const TestComponent = () => {
      const { startTour } = useTutorial();
      return (
        <div>
          <button onClick={startTour}>Start</button>
          <button data-tour="choose-reading-btn">Target</button>
        </div>
      );
    };

    render(
      <TutorialProvider>
        <TestComponent />
        <TutorialOverlay />
      </TutorialProvider>
    );

    fireEvent.click(screen.getByText('Start'));
    expect(screen.getByLabelText('Interactive Guided Tour')).toBeInTheDocument();

    // Click Skip Tour button
    const skipButtons = screen.getAllByRole('button', { name: /Skip Tour/i });
    fireEvent.click(skipButtons[0]);

    expect(screen.queryByLabelText('Interactive Guided Tour')).not.toBeInTheDocument();
    expect(localStorage.getItem('focusreader_tutorial_completed')).toBe('true');
  });

  it('calls onStepChange and triggers tab navigation when stepping into analytics or settings', async () => {
    const onStepChange = vi.fn();
    const analyticsIndex = TOUR_STEPS.findIndex((s) => s.id === 'analytics_view');

    const TestComponent = () => {
      const { goToStep } = useTutorial();
      return (
        <div>
          <button onClick={() => goToStep(analyticsIndex)}>Go To Analytics</button>
          <div data-tour="analytics-dashboard">Analytics Dashboard</div>
        </div>
      );
    };

    render(
      <TutorialProvider onStepChange={onStepChange}>
        <TestComponent />
        <TutorialOverlay />
      </TutorialProvider>
    );

    // Jump to analytics dashboard step
    fireEvent.click(screen.getByText('Go To Analytics'));

    expect(onStepChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'analytics_view',
        targetTab: 'analytics',
      })
    );
  });
});
