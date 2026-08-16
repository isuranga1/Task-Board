/**
 * The 1-5 "how did that feel" scale, in words.
 *
 * Its own module rather than an export from ReflectionPrompt: three components
 * render this scale (the prompt itself, the task detail modal, and the
 * look-back's completed list), and a component file that also exports
 * constants breaks fast refresh for everything importing it.
 *
 * Only the number is stored. Naming it here means the wording and emoji can
 * change without a migration, and the summary prompt gets a clean "4/5" rather
 * than an emoji it has to interpret.
 */
export const SATISFACTION = [
  { value: 1, emoji: "😮‍💨", label: "Slog" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Fine" },
  { value: 4, emoji: "😄", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
] as const;

/** The scale entry for a stored value, or undefined if it's null/out of range. */
export function satisfactionFor(value: number | null) {
  return value === null ? undefined : SATISFACTION.find((s) => s.value === value);
}
