import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useColorScheme } from '../../lib/theme';
import type { ConfigResponse } from '../../types';
import {
  Settings,
  Cpu,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

interface SettingsViewProps {
  onConfigUpdated?: (config: ConfigResponse) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onConfigUpdated }) => {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { preference, systemScheme, setScheme } = useColorScheme();

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      setBaseUrl(cfg.llm_base_url);
      setModel(cfg.llm_model);
      setTimeoutSeconds(cfg.llm_timeout_seconds);
      if (onConfigUpdated) onConfigUpdated(cfg);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to reach FocusReader backend.' });
    } finally {
      setIsLoading(false);
    }
  }, [onConfigUpdated]);

  useEffect(() => {
    let isMounted = true;
    api
      .getConfig()
      .then((cfg) => {
        if (isMounted) {
          setConfig(cfg);
          setBaseUrl(cfg.llm_base_url);
          setModel(cfg.llm_model);
          setTimeoutSeconds(cfg.llm_timeout_seconds);
          if (onConfigUpdated) onConfigUpdated(cfg);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusMessage({ type: 'error', text: 'Failed to reach FocusReader backend.' });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [onConfigUpdated]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const updated = await api.updateConfig({
        llm_base_url: baseUrl.trim(),
        llm_model: model.trim(),
        llm_timeout_seconds: Number(timeoutSeconds),
      });
      setConfig(updated);
      if (onConfigUpdated) onConfigUpdated(updated);

      if (updated.is_llm_connected) {
        setStatusMessage({
          type: 'success',
          text: 'Configuration saved! Successfully verified connection to local LLM endpoint.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Configuration saved, but could not connect to endpoint. Offline fallback will remain active.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-tour="settings-view" className="w-full max-w-2xl mx-auto py-8 space-y-6">
      {/* Reading Theme / Appearance Card */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs mb-2">
          <Sun className="w-4 h-4" />
          <span>Reading Appearance</span>
        </div>
        <h2 className="text-xl font-bold text-stone-100 tracking-tight mb-1.5 font-serif">
          Color Theme
        </h2>
        <p className="text-xs text-stone-400 mb-4 leading-relaxed">
          Choose between Warm Paper &amp; Ink for daytime reading, Cozy Library Night for low-light focus, or follow your device setting.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setScheme('light')}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              preference === 'light'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Light (Warm Paper)</span>
          </button>

          <button
            type="button"
            onClick={() => setScheme('dark')}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              preference === 'dark'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Moon className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Dark (Cozy Night)</span>
          </button>

          <button
            type="button"
            onClick={() => setScheme('light dark')}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              preference === 'light dark'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            <Monitor className="w-4 h-4 text-amber-400 shrink-0" />
            <span>System (Currently {systemScheme})</span>
          </button>
        </div>
      </div>

      {/* AI Reading Coach Card */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs">
            <Settings className="w-4 h-4" />
            <span>AI Coach Settings</span>
          </div>

          {config && (
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                config.is_llm_connected
                  ? 'bg-emerald-950/50 border border-emerald-600/30 text-emerald-300'
                  : 'bg-amber-950/50 border border-amber-600/30 text-amber-300'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{config.is_llm_connected ? 'AI Coach Ready' : 'Offline Practice Mode'}</span>
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-stone-100 tracking-tight mb-2 font-serif">
          Local AI Reading Coach
        </h1>
        <p className="text-xs text-stone-400 mb-6 leading-relaxed">
          FocusReader connects to your private local AI helper. If offline, all reading activities
          and metrics continue working smoothly.
        </p>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'border-emerald-600/30 bg-emerald-950/40 text-emerald-200'
                : 'border-amber-600/30 bg-amber-950/40 text-amber-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">
            Querying backend configuration...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="base-url" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Local AI Server URL
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:8080/v1"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                required
              />
              <p className="text-xs text-stone-400 mt-1">
                Restricted to localhost / internal networks for SSRF protection.
              </p>
            </div>

            <div>
              <label htmlFor="model-name" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Model Name
              </label>
              <input
                id="model-name"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Meta-Llama-3.1-8B-Instruct-Q8_0"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="timeout-sec" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Response Timeout (Seconds)
              </label>
              <input
                id="timeout-sec"
                type="number"
                min={1}
                max={120}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 focus:outline-none focus:border-amber-500 text-sm"
                required
              />
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs transition-all shadow-xl shadow-amber-700/20 flex items-center justify-center space-x-2 disabled:opacity-40 cursor-pointer"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Verifying & Saving...' : 'Save & Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={fetchConfig}
                className="px-4 py-3 rounded-xl border border-stone-700/80 hover:bg-stone-800 text-stone-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-stone-800 text-xs text-stone-400 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            FocusReader Classroom Privacy Guarantee: All student summaries, answers, and reading
            metrics remain strictly on your local device.
          </p>
        </div>
      </div>
    </div>
  );
};
