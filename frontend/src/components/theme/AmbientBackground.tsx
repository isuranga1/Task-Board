/**
 * The drifting color behind the whole app.
 *
 * Renders once and never re-renders: it takes no props and holds no state, so
 * React touches these six nodes exactly once at mount. All the movement is CSS
 * (see themes/ambient.css) and all the color is CSS variables, which means
 * switching theme recolors it with no React work at all.
 *
 * `aria-hidden` because it is pure decoration — a screen reader announcing five
 * empty divs would be noise, and there is nothing here to describe.
 */
export function AmbientBackground() {
  return (
    <div className="ambient-root" aria-hidden="true">
      <span className="ambient-blob ambient-blob-1" />
      <span className="ambient-blob ambient-blob-2" />
      <span className="ambient-blob ambient-blob-3" />
      <span className="ambient-blob ambient-blob-4" />
      <span className="ambient-blob ambient-blob-5" />
      <span className="ambient-grain" />
    </div>
  );
}
