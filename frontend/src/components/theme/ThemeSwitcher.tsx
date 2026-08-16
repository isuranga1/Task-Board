import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { THEMES } from "../../themes";

/**
 * The palette button, top-right, and the theme list it opens.
 *
 * Top-right specifically because it's the one corner free on both layouts: the
 * nav is a centered pill up top on desktop and a full-width bar along the
 * bottom on a phone, and the Grow orb already owns bottom-right. Anywhere else
 * collides with something on one breakpoint or the other.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape closes, matching every other dismissible surface in the app; a click
  // anywhere outside does too, which a popover this small needs — it has no
  // backdrop of its own to catch the click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-40
        sm:right-6 sm:top-[calc(1rem+env(safe-area-inset-top))]"
    >
      <button
        onClick={() => setOpen((was) => !was)}
        aria-label="Change theme"
        aria-expanded={open}
        title="Change theme"
        className="glass glass-hover flex h-10 w-10 items-center justify-center rounded-full
          text-zinc-300 transition-transform hover:scale-105 active:scale-95"
      >
        <Palette size={17} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme"
          className="glass-panel absolute right-0 top-12 w-60 rounded-2xl p-2 motion-orb-panel"
          // The panel unfolds from the button it came out of, not from its own
          // centre — reuses the orb's animation, hence the origin override.
          style={{ transformOrigin: "top right" }}
        >
          {THEMES.map((t) => {
            const active = t.name === theme;
            return (
              <button
                key={t.name}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(t.name);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                {/* The swatch is the real preview — the page color it sits on
                    plus its three accents, which is most of what distinguishes
                    one theme from another at a glance. */}
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center gap-[2px] rounded-lg border border-white/10"
                  style={{ background: t.page }}
                >
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-3.5 w-[3px] rounded-full"
                      style={{ background: c }}
                    />
                  ))}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-200">{t.label}</span>
                  <span className="block text-[11px] text-zinc-500">{t.hint}</span>
                </span>

                {active && <Check size={15} className="shrink-0 text-emerald-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
