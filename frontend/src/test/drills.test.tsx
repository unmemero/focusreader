import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreFlightIntent } from '../components/drills/PreFlightIntent';
import { IndexCardPacer } from '../components/drills/IndexCardPacer';
import { IntentRecall } from '../components/drills/IntentRecall';
import { DebriefSynthesis } from '../components/drills/DebriefSynthesis';
import { SessionResults } from '../components/drills/SessionResults';
import type { CorpusPassage, SessionDetailResponse } from '../types';

const mockPassage: CorpusPassage = {
  id: 'test-passage-1',
  title: 'Quantum Entanglement and Bell Inequalities',
  domain: 'physics',
  source_attribution: 'J.S. Bell, Physics Physique Fizika 1964',
  passage_text:
    'In a seminal 1964 paper, John Stewart Bell proved that local hidden-variable theories cannot reproduce all predictions of quantum mechanics. This foundational result is quantified via Bell inequalities. Experimental tests conducted by Alain Aspect conclusively validated quantum entanglement over classical locality.',
  word_count: 42,
  lexical_density_score: 0.65,
};

describe('Drill Pipeline Components', () => {
  describe('PreFlightIntent (Stage 1)', () => {
    it('renders passage title only, transitions from focus lens to guiding question, and starts drill', () => {
      const onStartReading = vi.fn();
      const onBackToLibrary = vi.fn();
      render(
        <PreFlightIntent
          passage={mockPassage}
          onStartReading={onStartReading}
          onBackToLibrary={onBackToLibrary}
        />
      );

      // Only the passage title is shown at the top (no full passage metadata card)
      expect(screen.getByText('Quantum Entanglement and Bell Inequalities')).toBeInTheDocument();
      expect(screen.queryByText(/J.S. Bell/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Back to Library/i })).toBeInTheDocument();

      // Stage 1: Select focus lens appears initially
      expect(screen.getByText(/1. Choose Your Focus Lens/i)).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText(/e.g. What is the central puzzle or question/)
      ).not.toBeInTheDocument();

      // Click a lens to transition to Stage 2 (Guiding Question)
      fireEvent.click(screen.getByRole('button', { name: /Problems & Solutions/i }));

      // Stage 2: Guiding question and Back to Focus Lens button appear
      const backToLensBtn = screen.getByRole('button', { name: /Back to Focus Lens/i });
      expect(backToLensBtn).toBeInTheDocument();

      // Verify user can go back to focus lens and re-select
      fireEvent.click(backToLensBtn);
      expect(screen.getByText(/1. Choose Your Focus Lens/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Problems & Solutions/i }));

      const textarea = screen.getByPlaceholderText(/e.g. What is the central puzzle or question/);
      fireEvent.change(textarea, { target: { value: 'How does Aspect test Bell inequalities?' } });

      const submitBtn = screen.getByRole('button', { name: /Start Reading/i });
      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      expect(onStartReading).toHaveBeenCalledWith(
        'How does Aspect test Bell inequalities?',
        'bottleneck_tradeoff'
      );
    });
  });

  describe('IndexCardPacer (Stage 2)', () => {
    it('displays shrouded reading units, streamlined telemetry, and flags drift', () => {
      const onRecordDrift = vi.fn();
      const onFinishReading = vi.fn();

      render(
        <IndexCardPacer
          passage={mockPassage}
          targetQuestion="How does Aspect test Bell inequalities?"
          driftCount={0}
          onRecordDrift={onRecordDrift}
          onFinishReading={onFinishReading}
        />
      );

      expect(screen.getByText(/Elapsed Time/)).toBeInTheDocument();
      expect(screen.getByText(/Focus Breaks/)).toBeInTheDocument();
      expect(screen.queryByText(/Current Line/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Step 2: Guided Reading/)).not.toBeInTheDocument();

      // Click drift button
      const driftBtn = screen.getByRole('button', { name: /Lost My Place/i });
      fireEvent.click(driftBtn);
      expect(onRecordDrift).toHaveBeenCalled();

      // Click finish reading
      const finishBtn = screen.getByRole('button', { name: /Finished Reading/i });
      fireEvent.click(finishBtn);
      expect(onFinishReading).toHaveBeenCalled();
    });

    it('advances units with ArrowDown and finishes reading when pressing ArrowDown on the last line', () => {
      const onRecordDrift = vi.fn();
      const onFinishReading = vi.fn();

      render(
        <IndexCardPacer
          passage={mockPassage}
          targetQuestion="Target Question"
          driftCount={0}
          onRecordDrift={onRecordDrift}
          onFinishReading={onFinishReading}
        />
      );

      // Press Space for drift
      fireEvent.keyDown(window, { code: 'Space' });
      expect(onRecordDrift).toHaveBeenCalled();

      // mockPassage has 3 sentences; pressing ArrowDown 3 times reaches the end and finishes reading
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(onFinishReading).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(onFinishReading).toHaveBeenCalled();
    });
  });

  describe('IntentRecall (Stage 3)', () => {
    it('hides source text, shows target question, and submits working memory synthesis', () => {
      const onSubmitRecall = vi.fn();

      render(
        <IntentRecall
          targetQuestion="What is the significance of Bell inequalities?"
          focusLens="mechanism_invariant"
          onSubmitRecall={onSubmitRecall}
        />
      );

      expect(screen.getByText(/What is the significance of Bell inequalities/)).toBeInTheDocument();
      expect(screen.getByText(/The passage is hidden to help practice retrieving key ideas from memory/)).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Explain what you remember in your own words/);
      fireEvent.change(textarea, {
        target: { value: 'Bell inequalities establish mathematical limits that rule out local realism.' },
      });

      const submitBtn = screen.getByRole('button', { name: /Proceed to Summary/i });
      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      expect(onSubmitRecall).toHaveBeenCalledWith(
        'Bell inequalities establish mathematical limits that rule out local realism.',
        expect.any(Number)
      );
    });
  });

  describe('DebriefSynthesis (Stage 4)', () => {
    it('requires premise, pivot, and implication before enabling submission', () => {
      const onSubmitDebrief = vi.fn();

      render(<DebriefSynthesis onSubmitDebrief={onSubmitDebrief} />);

      const submitBtn = screen.getByRole('button', { name: /Complete Reading & View Report/i });
      expect(submitBtn).toBeDisabled();

      const premiseInput = screen.getByPlaceholderText(/In the beginning, the author introduces/);
      const pivotInput = screen.getByPlaceholderText(/However, a new challenge or discovery reveals/);
      const implicationInput = screen.getByPlaceholderText(/As a result, we learn that/);

      fireEvent.change(premiseInput, { target: { value: 'Quantum theory predicts entangled correlation.' } });
      fireEvent.change(pivotInput, { target: { value: 'Bell derived inequalities incompatible with local hidden variables.' } });
      fireEvent.change(implicationInput, { target: { value: 'Aspect experiments confirmed non-local quantum reality.' } });

      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      expect(onSubmitDebrief).toHaveBeenCalledWith({
        core_premise: 'Quantum theory predicts entangled correlation.',
        pivot_or_surprise: 'Bell derived inequalities incompatible with local hidden variables.',
        implication: 'Aspect experiments confirmed non-local quantum reality.',
      });
    });
  });

  describe('SessionResults (Stage 5)', () => {
    const mockDetails: SessionDetailResponse = {
      session: {
        id: 'sess-1234',
        corpus_id: 'test-passage-1',
        drill_type: 'sequential_pipeline',
        current_stage: 'completed',
        duration_seconds: 45,
        words_per_minute: 280,
        drift_count: 2,
        status: 'completed',
      },
      passage: mockPassage,
      drift_events: [
        { id: 'd-1', session_id: 'sess-1234', elapsed_seconds: 15, line_number: 1 },
        { id: 'd-2', session_id: 'sess-1234', elapsed_seconds: 35, line_number: 2 },
      ],
      mean_time_between_drifts: 22.5,
      intent: {
        id: 'i-1',
        session_id: 'sess-1234',
        focus_lens: 'mechanism_invariant',
        target_question: 'How do Bell inequalities test realism?',
        user_synthesis: 'By measuring correlations between entangled pairs.',
        response_latency_seconds: 12,
      },
      debrief: {
        id: 'deb-1',
        session_id: 'sess-1234',
        core_premise: 'Entanglement correlation.',
        pivot_or_surprise: 'Bell limit violation.',
        implication: 'Standard QM confirmed.',
      },
      evaluations: [
        {
          id: 'eval-1',
          session_id: 'sess-1234',
          target_type: 'debrief',
          target_id: 'deb-1',
          evaluation_status: 'completed',
          clarity_score: 9,
          conciseness_score: 8,
          insight_score: 9,
          composite_score: 8.7,
          constructive_feedback: 'Exceptional retention and mechanical precision.',
          evaluator_model: 'gemma-2-9b-it',
        },
      ],
    };

    it('renders 4-slide presentation report deck and navigates through slides to full report', () => {
      const onRestart = vi.fn();
      const onGoToAnalytics = vi.fn();

      render(
        <SessionResults
          sessionDetails={mockDetails}
          onRestart={onRestart}
          onGoToAnalytics={onGoToAnalytics}
        />
      );

      // Slide 1: Reading Summary
      expect(screen.getByText('Reading Summary')).toBeInTheDocument();
      expect(screen.getByText('280')).toBeInTheDocument(); // WPM
      expect(screen.getByText('2')).toBeInTheDocument(); // Drift count
      expect(screen.getByText('22.5s')).toBeInTheDocument(); // MTBD

      // Advance to Slide 2: AI Reading Coach Feedback (Scores)
      fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
      expect(screen.getByText('AI Reading Coach Feedback')).toBeInTheDocument();
      expect(screen.getByText('8.7 / 10')).toBeInTheDocument();

      // Advance to Slide 3: Coach Feedback & Tips
      fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
      expect(screen.getByText('Coach Feedback & Tips')).toBeInTheDocument();
      expect(screen.getByText('Exceptional retention and mechanical precision.')).toBeInTheDocument();

      // Advance to Slide 4: Full Session Report & Saved Answers (closed by default)
      fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
      expect(screen.queryByRole('button', { name: /^Next$/i })).not.toBeInTheDocument();
      expect(screen.getByText('Your Saved Answers')).toBeInTheDocument();
      expect(screen.queryByText('By measuring correlations between entangled pairs.')).not.toBeInTheDocument();

      // Toggle Your Saved Answers open
      fireEvent.click(screen.getByRole('button', { name: /Your Saved Answers/i }));
      expect(screen.getByText('By measuring correlations between entangled pairs.')).toBeInTheDocument();

      const restartBtn = screen.getByRole('button', { name: /Read Another Passage/i });
      fireEvent.click(restartBtn);
      expect(onRestart).toHaveBeenCalled();
    });

    it('displays offline fallback notice when LLM evaluation was skipped', () => {
      const offlineDetails: SessionDetailResponse = {
        ...mockDetails,
        evaluations: [
          {
            id: 'eval-offline',
            session_id: 'sess-1234',
            target_type: 'debrief',
            target_id: 'deb-1',
            evaluation_status: 'offline_skipped',
          },
        ],
      };

      render(
        <SessionResults
          sessionDetails={offlineDetails}
          onRestart={vi.fn()}
          onGoToAnalytics={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
      expect(screen.getByText(/Offline Practice Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Practiced in Offline Mode/i)).toBeInTheDocument();
    });
  });
});
