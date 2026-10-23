import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { AnalyticsProgressResponse } from '../../types';
import {
  BarChart2,
  TrendingUp,
  Award,
  Zap,
  Flag,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  onSelectSession: (sessionId: string) => void;
  onStartNewDrill: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onSelectSession,
  onStartNewDrill,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .getAnalytics()
      .then((data) => {
        if (isMounted) setAnalytics(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div data-tour="analytics-dashboard" className="w-full max-w-5xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs mb-1">
            <BarChart2 className="w-4 h-4" />
            <span>My Progress</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-100 tracking-tight font-serif">
            Reading Progress & History
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Track reading pace, focus streaks, and comprehension progress over time.
          </p>
        </div>

        <button
          onClick={onStartNewDrill}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-semibold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <span>Start Reading</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-xs text-stone-400">
          Loading reading progress...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-950/30 text-rose-200 text-xs">
          {error}
        </div>
      ) : analytics ? (
        <div className="space-y-8">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col">
              <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Readings</span>
              </span>
              <span className="text-2xl font-bold text-stone-100">
                {analytics.completed_sessions}
              </span>
              <span className="text-[11px] text-stone-400 mt-auto">
                of {analytics.total_sessions} total sessions
              </span>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col">
              <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Average Pace</span>
              </span>
              <span className="text-2xl font-bold text-stone-100">
                {analytics.average_wpm}
              </span>
              <span className="text-[11px] text-stone-400 mt-auto">Words / Min</span>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col">
              <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-1">
                <Award className="w-3.5 h-3.5 text-teal-400" />
                <span>Focus Streak</span>
              </span>
              <span className="text-2xl font-bold text-stone-100">
                {analytics.average_mtbd > 0 ? `${analytics.average_mtbd}s` : '∞'}
              </span>
              <span className="text-[11px] text-stone-400 mt-auto">Avg. Unbroken Focus</span>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col">
              <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-1">
                <Flag className="w-3.5 h-3.5 text-amber-400" />
                <span>Focus Breaks</span>
              </span>
              <span className="text-2xl font-bold text-stone-100">
                {analytics.total_drift_events}
              </span>
              <span className="text-[11px] text-stone-400 mt-auto">Lost Place Count</span>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col col-span-2 lg:col-span-1">
              <span className="text-xs text-stone-400 font-medium flex items-center space-x-1 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Completion Rate</span>
              </span>
              <span className="text-2xl font-bold text-stone-100">
                {analytics.total_sessions > 0
                  ? Math.round((analytics.completed_sessions / analytics.total_sessions) * 100)
                  : 0}
                %
              </span>
              <span className="text-[11px] text-stone-400 mt-auto">Completion Rate</span>
            </div>
          </div>

          {/* Recent Sessions List */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-stone-100 mb-4 font-serif">
              Recent Reading History
            </h2>

            {analytics.recent_sessions.length === 0 ? (
              <p className="text-xs text-stone-400 py-8 text-center">
                No reading sessions recorded yet. Pick your first text from the Reading Library!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-800 text-stone-400 font-semibold text-[11px]">
                      <th className="py-3 px-3">Session</th>
                      <th className="py-3 px-3">Pace</th>
                      <th className="py-3 px-3">Focus Breaks</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {analytics.recent_sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-stone-900/50 transition-colors">
                        <td className="py-3.5 px-3 font-semibold text-stone-200">
                          <span className="truncate max-w-[180px] inline-block text-xs">
                            {sess.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-emerald-400 font-semibold">
                          {sess.words_per_minute} WPM
                        </td>
                        <td className="py-3.5 px-3 text-amber-400">
                          {sess.drift_count} focus breaks
                        </td>
                        <td className="py-3.5 px-3 text-stone-400">
                          <span className="inline-flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{sess.duration_seconds}s</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              sess.status === 'completed'
                                ? 'bg-emerald-950/50 border border-emerald-600/30 text-emerald-300'
                                : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => onSelectSession(sess.id)}
                            className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                          >
                            Review &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
