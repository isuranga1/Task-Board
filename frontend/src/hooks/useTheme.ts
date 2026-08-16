import { useEffect } from "react";
import { usePersistedState } from "./usePersistedState";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemeName,
  themeMeta,
  type ThemeName,
} from "../themes";

/**
 * Owns which theme is active: persists it, and stamps it on <html> where the
 * CSS in themes.css is waiting for it.
 *
 * The attribute goes on documentElement rather than on a wrapper div because
 * `body` and the scrollbar pseudo-elements need the variables too, and neither
 * is inside React's tree.
 */
export function useTheme() {
  const [stored, setTheme] = usePersistedState<ThemeName>(
    THEME_STORAGE_KEY,
    DEFAULT_THEME
  );

  // Guards against a hand-edited or stale localStorage value naming a theme
  // that no longer exists, which would otherwise leave `data-theme` pointing at
  // nothing and the app rendering with half the variables undefined.
  const theme = isThemeName(stored) ? stored : DEFAULT_THEME;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    // Keep the iOS status bar / Android chrome in step with the page. Without
    // this the bar stays whatever the last theme painted, which on a switch
    // from Midnight to Claude leaves a black band above a cream page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeMeta(theme).page);
  }, [theme]);

  return { theme, setTheme, meta: themeMeta(theme) };
}
