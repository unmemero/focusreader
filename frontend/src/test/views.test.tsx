import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { CorpusLibrary } from '../components/corpus/CorpusLibrary';
import { CorpusIngestion } from '../components/ingestion/CorpusIngestion';
import { SettingsView } from '../components/settings/SettingsView';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getPassages: vi.fn(),
    getRandomPassage: vi.fn(),
    ingestCorpus: vi.fn(),
    suggestPassage: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getAnalytics: vi.fn(),
  },
}));

describe('View Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CorpusLibrary', () => {
    it('renders toggleable passage list, expands details on toggle, and handles selection', async () => {
      const mockList = [
        {
          id: 'p-1',
          title: 'The Origin of Continents and Oceans',
          domain: 'physics' as const,
          source_attribution: 'Alfred Wegener, 1915',
          passage_text: 'Continental drift hypothesis...',
          word_count: 240,
          lexical_density_score: 0.58,
        },
      ];
      vi.mocked(api.getPassages).mockResolvedValue(mockList);

      const onSelectPassage = vi.fn();

      render(<CorpusLibrary onSelectPassage={onSelectPassage} />);

      await waitFor(() => {
        expect(screen.getByText('The Origin of Continents and Oceans')).toBeInTheDocument();
      });

      // When collapsed (off), word count, attribution, and preview are hidden
      expect(screen.queryByText('240 words')).not.toBeInTheDocument();
      expect(screen.queryByText('Alfred Wegener, 1915')).not.toBeInTheDocument();
      expect(screen.queryByText('Continental drift hypothesis...')).not.toBeInTheDocument();
      expect(screen.queryByText(/Guided 5-Step Reading/i)).not.toBeInTheDocument();

      // Expand the row using the toggle arrow button
      const toggleBtn = screen.getByRole('button', {
        name: /Toggle details for The Origin of Continents and Oceans/i,
      });
      fireEvent.click(toggleBtn);

      // When expanded (on), word count, difficulty badge, attribution, and preview are visible
      expect(screen.getByText('240 words')).toBeInTheDocument();
      expect(screen.getByText('Alfred Wegener, 1915')).toBeInTheDocument();
      expect(screen.getByText('Continental drift hypothesis...')).toBeInTheDocument();
      expect(screen.getAllByText(/Easy|Medium|Hard/i).length).toBeGreaterThan(0);

      const startBtn = screen.getByRole('button', { name: /Start Reading/i });
      fireEvent.click(startBtn);
      expect(onSelectPassage).toHaveBeenCalledWith('p-1');
    });

    it('renders back to studio button when onBack is provided and invokes callback', async () => {
      vi.mocked(api.getPassages).mockResolvedValue([]);
      const onBack = vi.fn();
      render(<CorpusLibrary onSelectPassage={vi.fn()} onBack={onBack} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Back to Reading Studio/i })).toBeInTheDocument();
      });

      const backBtn = screen.getByRole('button', { name: /Back to Reading Studio/i });
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('CorpusIngestion', () => {
    it('submits valid passage form with subject area and difficulty', async () => {
      vi.mocked(api.ingestCorpus).mockResolvedValue({
        message: 'Successfully ingested',
        passages_created: 1,
        passages: [],
      });

      const onBackToLibrary = vi.fn();
      const onSuccess = vi.fn();

      render(<CorpusIngestion onBackToLibrary={onBackToLibrary} onSuccess={onSuccess} />);

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Paper' } });
      fireEvent.change(screen.getByLabelText(/Difficulty/i), { target: { value: 'Hard' } });
      fireEvent.change(screen.getByLabelText(/Author \/ Source/i), {
        target: { value: 'Researcher, 2024' },
      });
      fireEvent.change(screen.getByLabelText(/Passage Text/i), {
        target: { value: 'This is an authentic excerpt for testing cognitive recall.' },
      });

      const submitBtn = screen.getByRole('button', { name: /Add Reading Passage/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.ingestCorpus).toHaveBeenCalledWith({
          title: 'Test Paper',
          domain: 'general_humanities',
          source_attribution: 'Researcher, 2024',
          text: 'This is an authentic excerpt for testing cognitive recall.',
          difficulty: 'Hard',
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows non-generative AI curator when connected and populates extracted sections', async () => {
      vi.mocked(api.suggestPassage).mockResolvedValue({
        doc_id: 'wiki_honey_bee',
        title: 'How Honeybees Map Distance and Direction',
        domain: 'biology',
        difficulty: 'Easy',
        classified_topics: ['Ethology', 'Animal Communication'],
        source_attribution: "Karl von Frisch, 'The Dancing Bees' (1953)",
        text: 'When a scout honeybee discovers a rich patch of clover, she returns to the hive.',
        word_count: 15,
        selected_sections: "Deterministically extracted from Wikipedia 'Waggle dance' — Section 'Lead' (Paragraphs 1–3 of 4)",
        total_sections: 4,
        selection_reason: 'Selected paragraphs 1–3 and classified as Easy in Ethology.',
        extraction_method: 'deterministic_wikipedia',
        source: 'gemma',
      });

      render(
        <CorpusIngestion
          isLlmConnected={true}
          onBackToLibrary={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/Topic or prompt/i), {
        target: { value: 'honeybee waggle dance navigation' },
      });

      const suggestBtn = screen.getByRole('button', { name: /Suggest Passage/i });
      fireEvent.click(suggestBtn);

      await waitFor(() => {
        expect(api.suggestPassage).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt_parameters: 'honeybee waggle dance navigation',
          })
        );
        expect(
          screen.getByDisplayValue('How Honeybees Map Distance and Direction')
        ).toBeInTheDocument();
        expect(screen.getByText(/Deterministically extracted from Wikipedia/i)).toBeInTheDocument();
        expect(screen.getByText('Ethology')).toBeInTheDocument();
      });
    });
  });

  describe('SettingsView', () => {
    it('displays config and allows updates', async () => {
      vi.mocked(api.getConfig).mockResolvedValue({
        llm_base_url: 'http://localhost:8080/v1',
        llm_model: 'gemma-2-9b-it',
        llm_timeout_seconds: 30,
        is_llm_connected: true,
      });

      vi.mocked(api.updateConfig).mockResolvedValue({
        llm_base_url: 'http://localhost:8080/v1',
        llm_model: 'gemma-2-9b-it',
        llm_timeout_seconds: 45,
        is_llm_connected: true,
      });

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('gemma-2-9b-it')).toBeInTheDocument();
        expect(screen.getByText(/AI Coach Ready/i)).toBeInTheDocument();
      });

      const timeoutInput = screen.getByLabelText(/Response Timeout/i);
      fireEvent.change(timeoutInput, { target: { value: '45' } });

      const saveBtn = screen.getByRole('button', { name: /Save & Test Connection/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.updateConfig).toHaveBeenCalledWith({
          llm_base_url: 'http://localhost:8080/v1',
          llm_model: 'gemma-2-9b-it',
          llm_timeout_seconds: 45,
        });
      });
    });
  });

  describe('AnalyticsDashboard', () => {
    it('renders longitudinal summary and session table', async () => {
      vi.mocked(api.getAnalytics).mockResolvedValue({
        total_sessions: 5,
        completed_sessions: 4,
        average_wpm: 265,
        average_mtbd: 34,
        total_drift_events: 6,
        recent_sessions: [
          {
            id: 'sess-abc-123',
            corpus_id: 'corp-1',
            drill_type: 'sequential_pipeline',
            current_stage: 'completed',
            duration_seconds: 52,
            words_per_minute: 275,
            drift_count: 1,
            status: 'completed',
          },
        ],
      });

      const onSelectSession = vi.fn();
      const onStartNewDrill = vi.fn();

      render(
        <AnalyticsDashboard
          onSelectSession={onSelectSession}
          onStartNewDrill={onStartNewDrill}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('265')).toBeInTheDocument(); // Average WPM
        expect(screen.getByText('34s')).toBeInTheDocument(); // Mean MTBD
        expect(screen.getByText('275 WPM')).toBeInTheDocument(); // Recent session row
      });

      const reviewBtn = screen.getByRole('button', { name: /Review →/i });
      fireEvent.click(reviewBtn);
      expect(onSelectSession).toHaveBeenCalledWith('sess-abc-123');
    });
  });

  describe('Reading Studio Flow in App', () => {
    it('displays punchy phrase and navigates to library when clicking Choose a Reading Passage', async () => {
      vi.mocked(api.getConfig).mockResolvedValue({
        llm_base_url: 'http://localhost:8080',
        llm_model: 'gemma-2-9b-it',
        llm_timeout_seconds: 15,
        is_llm_connected: true,
      });
      vi.mocked(api.getPassages).mockResolvedValue([
        {
          id: 'p-1',
          title: 'Quantum Computation and Shor’s Algorithm',
          domain: 'computer_science',
          source_attribution: 'Peter Shor, 1994',
          passage_text: 'Quantum algorithms enable polynomial time factoring...',
          word_count: 280,
          lexical_density_score: 0.62,
        },
      ]);

      render(<App />);

      // Verify Reading Studio title and punchy tagline
      expect(screen.getByRole('heading', { name: 'Reading Studio' })).toBeInTheDocument();
      expect(screen.getByText('Read faster. Focus deeper. Learn better.')).toBeInTheDocument();

      // Click "Choose a Reading Passage"
      const chooseBtn = screen.getByRole('button', { name: /Choose a Reading Passage/i });
      fireEvent.click(chooseBtn);

      // Verify the integrated library is displayed
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Articles & Stories' })).toBeInTheDocument();
      });

      // Verify the Back to Reading Studio button works
      const backBtn = screen.getByRole('button', { name: /Back to Reading Studio/i });
      fireEvent.click(backBtn);
      expect(screen.getByText('Read faster. Focus deeper. Learn better.')).toBeInTheDocument();
    });
  });
});
