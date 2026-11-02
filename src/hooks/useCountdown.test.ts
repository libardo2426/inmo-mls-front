import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('empieza en 0 y cuenta hacia atrás cada segundo hasta 0', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.remaining).toBe(0);

    act(() => result.current.start(3));
    expect(result.current.remaining).toBe(3);

    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(2);
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.remaining).toBe(0);
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current.remaining).toBe(0);
  });

  it('volver a empezar reinicia la cuenta', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(5));
    act(() => void vi.advanceTimersByTime(2000));
    act(() => result.current.start(10));
    expect(result.current.remaining).toBe(10);
  });

  it('ignora valores no válidos (negativos, NaN)', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(Number.NaN));
    expect(result.current.remaining).toBe(0);
    act(() => result.current.start(-4));
    expect(result.current.remaining).toBe(0);
  });

  it('limpia el temporizador al desmontar', () => {
    const { result, unmount } = renderHook(() => useCountdown());
    act(() => result.current.start(5));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
