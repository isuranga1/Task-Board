import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { PeriodReview, ReviewPeriod } from "../types";

/**
 * Owns one window's look-back: what you finished in it, and the written review
 * if there is one.
 *
 * Loading is free and happens on mount and on every period switch — reading
 * back your own completed work should never cost a request, so the panel is
 * useful before the LLM is ever involved. Only `generate` spends anything, and
 * the remaining count comes back from the server with every response rather
 * than being decremented locally: the same reasoning as useGrowth, since the
 * board gets opened from more than one device.
 */
export function usePeriodReview(period: ReviewPeriod) {
  const [review, setReview] = useState<PeriodReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same guard as the Grow orb: React state updates are async, so `generating`
  // isn't reliably true yet when a double-click's second handler runs — and
  // every duplicate here spends a real request.
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPeriodReview(period)
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReview(null);
        setError(err instanceof ApiError ? err.detail : "Couldn't reach the server.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const generate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setGenerating(true);
    setError(null);
    try {
      // The POST returns the whole review shape, not just the summary, so the
      // refreshed quota and staleness land in the same round trip.
      setReview(await api.generatePeriodReview(period));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
        // 429 (budget spent) and 400 (nothing finished in this window) both
        // change what the button should say, so resync rather than leaving the
        // UI inviting another doomed click.
        if (err.status === 429 || err.status === 400) {
          const fresh = await api.getPeriodReview(period).catch(() => null);
          if (fresh) setReview(fresh);
        }
      } else {
        setError("Couldn't reach the server.");
      }
    } finally {
      inFlight.current = false;
      setGenerating(false);
    }
  }, [period]);

  return { review, loading, generating, error, generate };
}
