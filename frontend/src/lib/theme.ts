import { useState, useEffect, useCallback } from 'react';

export type ColorSchemePreference = 'light dark' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

function getSystemScheme(): ResolvedColorScheme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getStoredPreference(): ColorSchemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light dark';
}

export function applyMetaColorScheme(pref: ColorSchemePreference): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'color-scheme';
    document.head.appendChild(meta);
  }
  meta.content = pref;
}

export function setColorSchemePreference(pref: ColorSchemePreference): void {
  try {
    if (pref === 'light dark') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // Ensure theme is still applied to the page even if localStorage throws
  }
  applyMetaColorScheme(pref);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('color-scheme-changed'));
  }
}

/**
 * Two-state toggle logic following modern-web-guidance `dark-mode-toggle`:
 * - Target scheme is the opposite of the currently rendered scheme.
 * - If target matches the current system preference, remove the stored override
 *   and return to `light dark` (system default).
 * - Otherwise store the target literally (`light` or `dark`).
 */
export function toggleColorScheme(): void {
  const stored = getStoredPreference();
  const system = getSystemScheme();
  const currentRendered: ResolvedColorScheme = stored === 'light dark' ? system : stored;
  const target: ResolvedColorScheme = currentRendered === 'dark' ? 'light' : 'dark';

  if (target === system) {
    setColorSchemePreference('light dark');
  } else {
    setColorSchemePreference(target);
  }
}

export function useColorScheme() {
  const [preference, setPreference] = useState<ColorSchemePreference>(() =>
    getStoredPreference()
  );
  const [systemScheme, setSystemScheme] = useState<ResolvedColorScheme>(() =>
    getSystemScheme()
  );

  useEffect(() => {
    const syncFromStorage = () => {
      const pref = getStoredPreference();
      applyMetaColorScheme(pref);
      setPreference(pref);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('color-scheme-changed', syncFromStorage);

    let mql: MediaQueryList | null = null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      // Update systemScheme for UI display only; NEVER remove stored override on OS change
      setSystemScheme(e.matches ? 'dark' : 'light');
    };

    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', handleMediaChange);
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('color-scheme-changed', syncFromStorage);
      if (mql) {
        mql.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const resolvedScheme: ResolvedColorScheme =
    preference === 'light dark' ? systemScheme : preference;

  const toggle = useCallback(() => {
    toggleColorScheme();
  }, []);

  const setScheme = useCallback((pref: ColorSchemePreference) => {
    setColorSchemePreference(pref);
  }, []);

  return {
    preference,
    systemScheme,
    resolvedScheme,
    toggle,
    setScheme,
  };
}
