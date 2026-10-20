import React from 'react';
import type { ReactNode } from 'react';
import { useSession } from '../../hooks/useSession';
import { useColorScheme } from '../../lib/theme';
import {
  BookOpen,
  BarChart2,
  Settings,
  Eye,
  Activity,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

interface ShellProps {
  children: ReactNode;
  activeTab: 'drill' | 'corpus' | 'analytics' | 'settings';
  onTabChange: (tab: 'drill' | 'corpus' | 'analytics' | 'settings') => void;
}

export const Shell: React.FC<ShellProps> = ({ children, activeTab, onTabChange }) => {
  const { isDistractionFree, config, activeSession } = useSession();
  const { resolvedScheme, toggle } = useColorScheme();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-stone-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-100 transition-colors duration-200">
      {/* Top Header - hidden automatically in Distraction-Free active reading mode */}
      {!isDistractionFree && (
        <header className="border-b border-stone-800/80 bg-stone-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('drill')}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-700 to-amber-500 flex items-center justify-center shadow-md shadow-amber-700/15">
                <BookOpen className="w-5 h-5 text-stone-950" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-stone-100 font-serif">
                  FocusReader
                </span>
                <span className="block text-[11px] text-stone-400 font-medium tracking-wide">
                  Reading Assistant
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => onTabChange('drill')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'drill'
                    ? 'bg-stone-800 text-amber-100 shadow-sm border border-stone-700/70'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                }`}
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Reading Studio</span>
              </button>

              <button
                onClick={() => onTabChange('corpus')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'corpus'
                    ? 'bg-stone-800 text-amber-100 shadow-sm border border-stone-700/70'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Library</span>
              </button>

              <button
                onClick={() => onTabChange('analytics')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-stone-800 text-amber-100 shadow-sm border border-stone-700/70'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-teal-400" />
                <span>My Progress</span>
              </button>

              <button
                onClick={() => onTabChange('settings')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-stone-800 text-amber-100 shadow-sm border border-stone-700/70'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                }`}
              >
                <Settings className="w-4 h-4 text-stone-400" />
                <span>Settings</span>
              </button>
            </nav>

            {/* Theme Toggle & Status Indicator */}
            <div className="flex items-center space-x-2.5 text-xs font-medium">
              <button
                type="button"
                onClick={toggle}
                aria-label={
                  resolvedScheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
                }
                title={
                  resolvedScheme === 'dark'
                    ? 'Switch to Warm Paper (Light Mode)'
                    : 'Switch to Cozy Library Night (Dark Mode)'
                }
                className="p-2 rounded-lg border border-stone-700/80 bg-stone-800/60 hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
              >
                {resolvedScheme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-stone-300" />
                )}
              </button>

              <div
                role="status"
                aria-label={
                  config?.is_llm_connected
                    ? `AI Coach Connected (${config.llm_model})`
                    : 'AI Coach Disconnected (Offline Mode)'
                }
                className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
                  config?.is_llm_connected
                    ? 'border-emerald-600/35 bg-emerald-950/50 text-emerald-400'
                    : 'border-rose-600/35 bg-rose-950/50 text-rose-400'
                }`}
                title={
                  config?.is_llm_connected
                    ? `Connected to AI Assistant (${config.llm_model})`
                    : 'Offline Practice Mode: Reading stats are saved safely'
                }
              >
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main App Content Viewport */}
      <main className="flex-1 flex flex-col items-center justify-start w-full relative">
        {/* Subtle indicator bar when in Distraction-Free Mode */}
        {isDistractionFree && activeSession && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-4 px-3 py-1 bg-stone-900/90 border border-stone-800/80 rounded-full text-[11px] font-medium text-stone-400 backdrop-blur-md opacity-40 hover:opacity-100 transition-opacity">
            <span className="flex items-center space-x-1 text-amber-400">
              <Activity className="w-3 h-3" />
              <span>Guided Reading Active</span>
            </span>
            <span>Esc to exit</span>
          </div>
        )}

        <div className="w-full max-w-5xl px-4 py-6 flex-1 flex flex-col">{children}</div>
      </main>

      {/* Footer - only shown outside distraction-free reading */}
      {!isDistractionFree && (
        <footer className="border-t border-stone-800/70 py-4 text-center text-xs text-stone-500">
          FocusReader • MIT Licensed 2026
        </footer>
      )}
    </div>
  );
};
