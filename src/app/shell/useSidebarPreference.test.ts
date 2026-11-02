import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSidebarPreference } from './useSidebarPreference';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSidebarPreference', () => {
  it('por defecto el menú está abierto', () => {
    const { result } = renderHook(() => useSidebarPreference());
    expect(result.current[0]).toBe(true);
  });

  it('recuerda que se plegó al volver a montar', () => {
    const first = renderHook(() => useSidebarPreference());
    act(() => first.result.current[1](false));
    expect(first.result.current[0]).toBe(false);
    first.unmount();
    const second = renderHook(() => useSidebarPreference());
    expect(second.result.current[0]).toBe(false);
  });

  it('si localStorage lanza, abre expandido y plegar funciona en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { result } = renderHook(() => useSidebarPreference());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
