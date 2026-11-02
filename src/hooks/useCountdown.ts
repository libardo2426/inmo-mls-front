import { useCallback, useEffect, useRef, useState } from 'react';

/** Cuenta atrás en segundos (para esperas de rate limit). `remaining === 0` significa inactiva. */
export function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stop = useCallback(() => {
    if (timer.current !== undefined) clearInterval(timer.current);
    timer.current = undefined;
  }, []);

  const start = useCallback(
    (seconds: number) => {
      stop();
      if (!Number.isFinite(seconds) || seconds <= 0) {
        setRemaining(0);
        return;
      }
      setRemaining(Math.floor(seconds));
      timer.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    },
    [stop],
  );

  useEffect(() => {
    if (remaining === 0) stop();
  }, [remaining, stop]);

  useEffect(() => stop, [stop]);

  return { remaining, start };
}
