import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardControls } from '../hooks/useKeyboardControls';

describe('useKeyboardControls Hook (Unit Tests)', () => {
  it('triggers onFlagDrift on Space keydown', () => {
    const onFlagDrift = vi.fn();
    renderHook(() => useKeyboardControls({ onFlagDrift, enabled: true }));

    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    window.dispatchEvent(event);

    expect(onFlagDrift).toHaveBeenCalledTimes(1);
  });

  it('triggers onAdvanceLine on ArrowDown and Key J', () => {
    const onAdvanceLine = vi.fn();
    renderHook(() => useKeyboardControls({ onAdvanceLine, enabled: true }));

    // ArrowDown
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onAdvanceLine).toHaveBeenCalledTimes(1);

    // 'j'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    expect(onAdvanceLine).toHaveBeenCalledTimes(2);

    // 'J'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', bubbles: true }));
    expect(onAdvanceLine).toHaveBeenCalledTimes(3);
  });

  it('triggers onConfirm on Enter key', () => {
    const onConfirm = vi.fn();
    renderHook(() => useKeyboardControls({ onConfirm, enabled: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('triggers onEscape on Escape key', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardControls({ onEscape, enabled: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('INVARIANT: ignores navigation keys when typing in input or textarea', () => {
    const onFlagDrift = vi.fn();
    const onAdvanceLine = vi.fn();
    const onConfirm = vi.fn();

    renderHook(() =>
      useKeyboardControls({
        onFlagDrift,
        onAdvanceLine,
        onConfirm,
        enabled: true,
      })
    );

    // Simulate event on an input element
    const input = document.createElement('input');
    document.body.appendChild(input);

    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(spaceEvent, 'target', { value: input });
    window.dispatchEvent(spaceEvent);

    const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    Object.defineProperty(arrowEvent, 'target', { value: input });
    window.dispatchEvent(arrowEvent);

    expect(onFlagDrift).not.toHaveBeenCalled();
    expect(onAdvanceLine).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
