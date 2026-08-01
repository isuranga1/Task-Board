/**
 * Motion module — the single place the rest of the app talks to for animation.
 *
 * Components never hard-code an animation class name. They ask this module for
 * one ("what should a card that just arrived in Done look like?") and get back
 * a string. That indirection is the whole point: swapping, retuning, or
 * disabling an animation happens here and in ./motion.css, never in a
 * component, so the board's look can change without touching board logic.
 *
 * Three things you might want to do:
 *   - Retune how something looks/feels ......... edit ./motion.css
 *   - Turn one animation off .................... flip a flag in `motionFlags`
 *   - Turn ALL animation off .................... set every flag to false
 *
 * (Users with "reduce motion" enabled at the OS level are already handled in
 * motion.css — no flag needed for that.)
 */

import type { TaskStatus } from "../types";
import type { CardMotion } from "./hooks";

/**
 * Master switches. Each one maps to a named effect described below; setting it
 * to `false` stops the class from being applied at all, which is cheaper and
 * more certain than trying to override the CSS.
 */
export const motionFlags = {
  /** Cards fade + rise in when they first render. */
  cardEnter: true,
  /** Cards pop and flash a colored ring when they land in a NEW column. */
  cardArrive: true,
  /** A slow glow on the left edge of anything sitting in "Doing". */
  activePulse: true,
  /** Columns rise in when you switch space or group. */
  columnEnter: true,
  /** Dashed ring on a column while a card is dragged over it. */
  dropTarget: true,
  /** The task-count chip bumps when the number changes. */
  countBump: true,
  /** Ticking off a subtask sweeps a line across it instead of snapping one on. */
  checkStrike: true,
  /** Entering cards/columns cascade instead of appearing all at once. */
  stagger: true,
};

/** Which color a card's arrival ring flashes, per column. */
const ACCENT_CLASS: Record<TaskStatus, string> = {
  todo: "motion-accent-todo",
  in_progress: "motion-accent-progress",
  done: "motion-accent-done",
};

/**
 * The animation classes for a task card. `motion` comes from `useCardMotion`,
 * which is what actually knows whether the card moved or merely appeared.
 */
export function cardMotionClass(motion: CardMotion, status: TaskStatus): string {
  const classes: string[] = [];

  if (motion === "arrive" && motionFlags.cardArrive) {
    classes.push("motion-arrive", ACCENT_CLASS[status]);
  } else if (motionFlags.cardEnter) {
    classes.push("motion-enter");
  }

  // Only worth staggering things that are actually entering — a card popping
  // into a new column should react immediately, not wait its turn.
  if (motionFlags.stagger && classes.includes("motion-enter")) {
    classes.push("motion-stagger");
  }

  if (status === "in_progress" && motionFlags.activePulse) {
    classes.push("motion-active");
  }

  return classes.join(" ");
}

/** Classes for a column shell. `isOver` = a card is being dragged over it. */
export function columnMotionClass(isOver: boolean): string {
  const classes: string[] = [];
  if (motionFlags.dropTarget) {
    classes.push("motion-column");
    if (isOver) classes.push("motion-column-over");
  }
  if (motionFlags.columnEnter) {
    classes.push("motion-column-enter");
    if (motionFlags.stagger) classes.push("motion-stagger");
  }
  return classes.join(" ");
}

/**
 * Classes for a subtask's label. Falls back to a plain `line-through` when the
 * animation is switched off, because a ticked-off subtask has to *look* ticked
 * off whether or not anything is animating.
 */
export function strikeMotionClass(isDone: boolean): string {
  if (!motionFlags.checkStrike) return isDone ? "line-through" : "";
  return isDone ? "motion-strike motion-strike-on" : "motion-strike";
}

/** Classes for the little task-count chip next to a column title. */
export function countMotionClass(): string {
  return motionFlags.countBump ? "motion-bump" : "";
}

/**
 * Feeds the `--motion-i` custom property the stagger reads. Spread onto an
 * element's `style`: `style={{ ...staggerIndex(i) }}`.
 */
export function staggerIndex(index: number): React.CSSProperties {
  if (!motionFlags.stagger) return {};
  return { "--motion-i": index } as React.CSSProperties;
}

export { useCardMotion, useBumpKey } from "./hooks";
export type { CardMotion } from "./hooks";
