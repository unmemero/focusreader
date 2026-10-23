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
            </nav>

            {/* Right Controls: Analytics, Settings, Theme Toggle & AI Status */}
            <div className="flex items-center space-x-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => onTabChange('analytics')}
                aria-label="My Progress"
                title="My Progress"
                className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'border-teal-500 bg-teal-950/60 text-teal-300 shadow-sm ring-1 ring-teal-500/40'
                    : 'border-stone-700 bg-stone-800 text-teal-400 hover:bg-stone-700 hover:text-teal-300 hover:border-teal-500/60 shadow-xs active:scale-95'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="sr-only">My Progress</span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange('settings')}
                aria-label="Settings"
                title="Settings"
                className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-amber-500 bg-amber-950/60 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                    : 'border-stone-700 bg-stone-800 text-amber-400 hover:bg-stone-700 hover:text-amber-300 hover:border-amber-500/60 shadow-xs active:scale-95'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="sr-only">Settings</span>
              </button>

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
                className="p-2 rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-stone-50 hover:border-stone-500 shadow-xs transition-all duration-150 active:scale-95 cursor-pointer"
              >
                {resolvedScheme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-amber-200" />
                )}
              </button>

              {/* Frameless AI Spark in the far right corner */}
              <div
                role="status"
                aria-label={
                  config?.is_llm_connected
                    ? `AI Coach Online (${config.llm_model})`
                    : 'AI Coach Offline (Practice Mode)'
                }
                title={
                  config?.is_llm_connected
                    ? `AI Coach Online (${config.llm_model})`
                    : 'AI Coach Offline (Practice Mode)'
                }
                className="pl-1.5 flex items-center justify-center cursor-default select-none"
              >
                <Sparkles
                  className={`w-5 h-5 transition-colors duration-300 ${
                    config?.is_llm_connected
                      ? 'text-emerald-400 sparkle-twinkle'
                      : 'text-stone-500 opacity-40'
                  }`}
                />
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
