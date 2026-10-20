import { useSyncExternalStore } from "react";

// One clock for the whole page: a single interval, started by the first
// subscriber and stopped with the last, however many timestamps are on screen.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = Date.now();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * The current time, refreshed every minute — or null on the server and during
 * hydration. Server and browser clocks never agree to the minute, so anything
 * finer than a day must wait for null to turn into a number.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
