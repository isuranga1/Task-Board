# Motion module

All animation on the board lives here. Components ask this module for class
names; they never hard-code one. That means the board's *feel* can change
without touching board *logic*.

```
animations/
  motion.css   all keyframes + classes — the look
  index.ts     flags + "what class does X get?" helpers — the wiring
  hooks.ts     the two bits that need React state to work
```

## What's animated

| Effect         | Where                | What it does                                            |
| -------------- | -------------------- | ------------------------------------------------------- |
| `cardEnter`    | task cards           | fade + rise on first render                             |
| `cardArrive`   | task cards           | pop + a ring in the new column's color, after a move     |
| `activePulse`  | task cards in Doing  | slow glow on the left edge — "this is live right now"    |
| `columnEnter`  | To Do / Doing / Done | rise in when you switch space or group                   |
| `dropTarget`   | columns              | dashed ring while a card is dragged over                 |
| `countBump`    | column count chip    | bump when the number changes                             |
| `stagger`      | cards + columns      | entering items cascade instead of appearing at once      |

To Do / Doing / Done each flash their own accent color (`--color-accent-todo`,
`--color-accent-progress`, `--color-accent-done` from `index.css`), so the
arrival animation reads as "this task reached Done" and not just "something
moved".

## How to change things

**Retune a duration, distance, or easing** — the `:root` block at the top of
`motion.css`. Every animation reads from those variables, so widening
`--motion-enter-distance` or slowing `--motion-breathe-duration` applies
everywhere that effect is used.

**Turn one effect off** — flip its flag in `motionFlags` (`index.ts`). The class
stops being applied at all, which is more certain than overriding CSS.

**Turn everything off** — set every flag in `motionFlags` to `false`.

**Add a new effect** — write the keyframes + a `motion-`prefixed class in
`motion.css`, add a flag, and return the class from a helper in `index.ts`.
Keep the `motion-` prefix: it's what guarantees nothing here collides with a
Tailwind utility.

**Remove the module entirely** — delete this folder and the
`import "./animations/motion.css"` line in `main.tsx`. TypeScript will then
point at the handful of call sites to clean up.

## Two things worth knowing

**Arrival is free.** Dragging a card to another column unmounts it and mounts a
new one, so "did this card just move?" can't be answered from component state —
it's already gone. `useCardMotion` keeps a module-level `Map` of the last status
per task, which survives that remount. This is why the arrival animation needs
no timers, no transition state machine, and nothing passed down from the drag
handler.

**Reduced motion is handled.** The `prefers-reduced-motion` block at the bottom
of `motion.css` disables everything for anyone who asked their OS for it, while
keeping the static cues (the Doing edge glow stays, it just holds still). New
animations should be added to that block too.
