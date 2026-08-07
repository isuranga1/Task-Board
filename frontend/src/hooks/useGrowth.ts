import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { GrowthStatus, GrowthTip } from "../types";

/**
 * Owns the Grow orb's state: the daily budget, the tip on screen, and the
 * history behind it.
 *
 * The remaining-count is server-truth, never guessed locally. It would be easy
 * to decrement a local counter on each click, but the board is opened from more
 * than one device and the backend restarts on every deploy — the only number
 * that can't drift is the one the server derives from stored rows.
 */
export function useGrowth() {
  const [status, setStatus] = useState<GrowthStatus | null>(null);
  const [tip, setTip] = useState<GrowthTip | null>(null);
  const [history, setHistory] = useState<GrowthTip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a double-click firing two generations: React state updates
  // are async, so `loading` isn't reliably true yet by the time the second
  // click's handler runs — and every duplicate here spends a real request.
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getGrowthStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        setTip(s.latest);
      })
      .catch(() => {
        if (cancelled) return;
        // A backend that can't answer shouldn't leave the orb in a permanent
        // spinner — render it as unconfigured, which is the honest read of
        // "we can't confirm this works".
        setStatus({
          configured: false,
          used_today: 0,
          daily_limit: 0,
          remaining: 0,
          latest: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const fresh = await api.generateGrowthTip();
      setTip(fresh);
      // Prepend rather than refetch: the list is already correct with the new
      // tip on the front, and the count comes from /status below anyway.
      setHistory((prev) => (prev ? [fresh, ...prev] : prev));
      setStatus(await api.getGrowthStatus());
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
        // 429 means the budget is spent — resync so the UI shows 0 left and
        // disables the button instead of inviting another doomed click.
        if (err.status === 429) {
          setStatus(await api.getGrowthStatus().catch(() => null));
        }
      } else {
        setError("Couldn't reach the server.");
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  /** Lazily loaded — history is free to read, but only worth fetching if asked for. */
  const loadHistory = useCallback(async () => {
    if (history) return;
    try {
      setHistory(await api.listGrowthTips(20));
    } catch {
      setHistory([]);
    }
  }, [history]);

  return { status, tip, history, loading, error, generate, loadHistory, setTip };
}
