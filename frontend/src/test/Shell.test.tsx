/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
    expect(screen.getByText('My Progress')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Child Viewport Content')).toBeInTheDocument();
  });
});
