import { useEffect, useEffectEvent } from 'react';

export interface KeyboardControlsOptions {
  onAdvanceLine?: () => void;
  onFlagDrift?: () => void;
  onConfirm?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardControls({
  onAdvanceLine,
  onFlagDrift,
  onConfirm,
  onEscape,
  enabled = true,
}: KeyboardControlsOptions) {
  // Use React 19 useEffectEvent for stable callback identity
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // If the user is typing inside an input, textarea, or editable element, do not hijack keys
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
      }
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      onFlagDrift?.();
    } else if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J') {
      event.preventDefault();
      onAdvanceLine?.();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm?.();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onEscape?.();
    }
  });

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
