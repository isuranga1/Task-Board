import { useState, useEffect } from "react";

/**
 * useState that survives a reload, backed by localStorage.
 *
 * Filter choices are the motivating case: having every tick-box reset to its
 * default each time you open the board would make the filters feel disposable
 * rather than like a view you configured once.
 *
 * Falls back to plain in-memory state if storage is unavailable (private mode,
 * quota) — a browser that can't persist should still render a working page.
 */
export function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Nothing sensible to do — the value still lives in React state for
      // this session, which is the part that affects what's on screen.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
