/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { Shell } from '../components/layout/Shell';
import { SessionProvider } from '../context/SessionContext';

import { api } from '../lib/api';

describe('Shell Layout Component (Unit Tests)', () => {
  it('renders brand title and all navigation tabs in standard mode', async () => {
    vi.spyOn(api, 'getConfig').mockResolvedValue({
      llm_base_url: 'http://localhost:8080',
      llm_model: 'gemma-2-9b-it',
      llm_timeout_seconds: 15,
      is_llm_connected: true,
    });

    const onTabChange = vi.fn();

    await act(async () => {
      render(
        <SessionProvider>
          <Shell activeTab="drill" onTabChange={onTabChange}>
            <div>Child Viewport Content</div>
          </Shell>
        </SessionProvider>
      );
    });

    expect(screen.getByText('FocusReader')).toBeInTheDocument();
    expect(screen.getByText('Reading Studio')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.queryByText('Add Reading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByText('Child Viewport Content')).toBeInTheDocument();

    // Verify clicking chart icon triggers onTabChange('analytics')
    fireEvent.click(screen.getByRole('button', { name: /My Progress/i }));
    expect(onTabChange).toHaveBeenCalledWith('analytics');

    // Verify clicking settings icon triggers onTabChange('settings')
    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onTabChange).toHaveBeenCalledWith('settings');

    // Verify online frameless AI spark is displayed
    const statusElem = screen.getByRole('status');
    expect(statusElem).toHaveAttribute('aria-label', expect.stringContaining('AI Coach Online'));
    const sparkIcon = statusElem.querySelector('svg');
    expect(sparkIcon).toHaveClass('sparkle-twinkle', 'text-emerald-400');
  });

  it('renders greyed out frameless AI spark when offline', async () => {
    vi.spyOn(api, 'getConfig').mockResolvedValue({
      llm_base_url: 'http://localhost:8080',
      llm_model: 'gemma-2-9b-it',
      llm_timeout_seconds: 15,
      is_llm_connected: false,
    });

    await act(async () => {
      render(
        <SessionProvider>
          <Shell activeTab="drill" onTabChange={vi.fn()}>
            <div>Child Viewport Content</div>
          </Shell>
        </SessionProvider>
      );
    });

    const statusElem = screen.getByRole('status');
    expect(statusElem).toHaveAttribute('aria-label', expect.stringContaining('AI Coach Offline'));
    const sparkIcon = statusElem.querySelector('svg');
    expect(sparkIcon).toHaveClass('text-stone-500');
    expect(sparkIcon).not.toHaveClass('sparkle-twinkle');
  });
});
