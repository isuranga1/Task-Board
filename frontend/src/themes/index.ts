/**
 * The theme registry — the list the switcher renders, and the single source of
 * truth for which names are valid.
 *
 * Colors here are ONLY for the switcher's own swatches. Everything the app
 * actually renders in comes from CSS variables in themes.css; duplicating a
 * palette in TypeScript would guarantee the two drift apart. These three dots
 * are a label, not a definition.
 */

export const THEMES = [
  {
    name: "claude",
    label: "Claude",
    hint: "Warm cream and clay",
    scheme: "light",
    swatch: ["#d97757", "#e3c26a", "#8fb99a"],
    page: "#f7f4ee",
  },
  {
    name: "midnight",
    label: "Midnight",
    hint: "The original deep indigo",
    scheme: "dark",
    swatch: ["#7c8cff", "#ff9f6b", "#4ee1a0"],
    page: "#0b0b14",
  },
  {
    name: "aurora",
    label: "Aurora",
    hint: "Dark, but electric",
    scheme: "dark",
    swatch: ["#8b7cff", "#ff7ab6", "#38e8c8"],
    page: "#070912",
  },
  {
    name: "daybreak",
    label: "Daybreak",
    hint: "Cool and bright",
    scheme: "light",
    swatch: ["#4f63d2", "#e07a3f", "#1e9e77"],
    page: "#f1f5fb",
  },
] as const;

export type ThemeName = (typeof THEMES)[number]["name"];

export const DEFAULT_THEME: ThemeName = "claude";

/**
 * The localStorage key, shared with the inline boot script in index.html.
 *
 * That script runs before React and before first paint to avoid a flash of the
 * wrong theme, which means the key and the stored format are a contract between
 * two files. Changing either without changing index.html gives you a one-frame
 * flash on every load — the exact bug this exists to prevent.
 *
 * The value is written by usePersistedState, so it is JSON — a *quoted* string.
 */
export const THEME_STORAGE_KEY = "ui.theme";

export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.some((t) => t.name === value);
}

export function themeMeta(name: ThemeName) {
  return THEMES.find((t) => t.name === name) ?? THEMES[0];
}
