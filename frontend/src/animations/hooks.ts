import { useEffect, useRef, useState } from "react";
import type { TaskStatus } from "../types";

/** How a card got here: rendered for the first time, or moved from elsewhere. */
export type CardMotion = "enter" | "arrive";

/**
 * The last status we saw each task in, kept OUTSIDE React on purpose.
 *
 * Moving a card between columns unmounts it from one column and mounts a fresh
 * one in another, so any state stored inside the component is gone by the time
 * we'd want to ask "did this card just move?". A module-level map survives that
 * remount and is what lets the arrival animation be pure CSS with no timers,
 * no transition state machine, and no prop drilling from the drag handler.
 *
 * Entries are never removed: a deleted task leaves one stale number behind for
 * the rest of the session, which is not worth the bookkeeping to avoid.
 */
const lastSeenStatus = new Map<number, TaskStatus>();

/**
 * Decides whether a task card should animate as "just appeared" or "just moved
 * here", and freezes that answer for the lifetime of this mount so a re-render
 * mid-animation can't cut it short.
 */
export function useCardMotion(taskId: number, status: TaskStatus): CardMotion {
  const decision = useRef<CardMotion | null>(null);

  if (decision.current === null) {
    const previous = lastSeenStatus.get(taskId);
    // No previous status means this is the first time we've laid eyes on the
    // task — page load, or it was just created. That's an entrance, not a move,
    // so the board doesn't fire off a ring for every card on first paint.
    decision.current = previous !== undefined && previous !== status ? "arrive" : "enter";
  }

  // Recorded in an effect rather than during render so that React re-rendering
  // a component twice (StrictMode does exactly this in dev) can't overwrite the
  // previous status before the comparison above has had a chance to run.
  useEffect(() => {
    lastSeenStatus.set(taskId, status);
  }, [taskId, status]);

  return decision.current;
}

/**
 * Returns a number that changes whenever `value` does. Use it as a React `key`
 * on the element you want to re-animate:
 *
 *   <span key={useBumpKey(count)} className={countMotionClass()}>{count}</span>
 *
 * Remounting is the simplest reliable way to replay a CSS animation — the
 * alternatives all involve removing the class and forcing a reflow before
 * adding it back.
 */
export function useBumpKey(value: number): number {
  const [key, setKey] = useState(0);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setKey((k) => k + 1);
    }
  }, [value]);

  return key;
}
