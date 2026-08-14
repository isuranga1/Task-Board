import { useState, useEffect } from "react";
import { LayoutDashboard, BarChart3, CalendarClock, CalendarDays } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { Analytics } from "./pages/Analytics";
import { Deadlines } from "./pages/Deadlines";
import { CalendarView } from "./pages/CalendarView";
import { GrowthOrb } from "./components/growth/GrowthOrb";

type View = "dashboard" | "deadlines" | "calendar" | "analytics";

const NAV: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Board", icon: LayoutDashboard },
  { view: "deadlines", label: "Deadlines", icon: CalendarClock },
  { view: "calendar", label: "Calendar", icon: CalendarDays },
  { view: "analytics", label: "Insights", icon: BarChart3 },
];

/**
 * Reads the `?gcal=` marker the backend's OAuth callback redirects back with.
 *
 * The app has no router, so this is done once at startup rather than through
 * route state. The param is stripped from the URL immediately afterwards so a
 * refresh doesn't re-show the banner, and so the address bar doesn't keep
 * advertising a stale result.
 */
function readGoogleCallback(): { view: View | null; banner: string | null } {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("gcal");
  if (!result) return { view: null, banner: null };

  window.history.replaceState({}, "", window.location.pathname);

  if (result === "connected") {
    return { view: "calendar", banner: "Google Calendar connected." };
  }
  const reason = params.get("reason");
  return {
    view: "calendar",
    banner: `Couldn't connect Google Calendar${reason ? `: ${reason}` : "."}`,
  };
}

function App() {
  // Computed once, in the initializer, because readGoogleCallback has the side
  // effect of clearing the query string — running it on every render would
  // wipe the param before the first read in StrictMode's double invoke.
  const [callback] = useState(readGoogleCallback);
  const [view, setView] = useState<View>(callback.view ?? "dashboard");
  const [banner, setBanner] = useState<string | null>(callback.banner);

  const isError = banner !== null && banner.startsWith("Couldn't");

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(id);
  }, [banner]);

  return (
    // The safe-area insets are what keep content clear of the hardware the
    // page is painting behind. viewport-fit=cover (index.html) deliberately
    // extends the page under the status bar / Dynamic Island so the background
    // wash runs edge to edge — without this padding, the first heading would
    // sit under the clock. The left/right insets matter in landscape, where
    // the island eats into the side of the screen instead of the top.
    //
    // All three resolve to 0 in a desktop browser and in ordinary Safari
    // portrait (where Safari's own chrome already occupies that space), so
    // this costs nothing anywhere it isn't needed.
    <div
      className="min-h-dvh pt-[env(safe-area-inset-top)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {/* Two shapes, one list. On a phone the four labelled tabs simply don't
          fit across 375px as a centered pill, so they become a full-width bar
          pinned to the bottom — within thumb reach, and the same place iOS
          puts navigation in every native app. The floating top pill returns
          at sm, where there's room for it. */}
      <nav
        // Fixed, so it sits outside the wrapper's safe-area padding and has to
        // carry its own — including left/right, which is what stops the first
        // tab hiding under the island in landscape.
        className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch rounded-none
          pb-[env(safe-area-inset-bottom)]
          pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
          sm:sticky sm:inset-x-auto sm:bottom-auto sm:top-4 sm:mx-auto sm:mb-2 sm:w-fit sm:items-center
          sm:gap-1 sm:rounded-full sm:p-1 sm:px-1.5 sm:pb-1"
      >
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-current={v === view ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-none px-1 py-2.5 text-[11px] font-medium transition-all
              sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm
              ${
                v === view
                  ? "text-white sm:bg-white sm:text-black sm:shadow-sm"
                  : "text-zinc-500 sm:text-zinc-400 sm:hover:text-white"
              }`}
          >
            <Icon size={19} className="sm:h-[15px] sm:w-[15px]" /> {label}
          </button>
        ))}
      </nav>

      {banner && (
        <div
          className={`glass mx-auto mt-3 w-fit rounded-full px-4 py-2 text-sm ${
            isError ? "text-rose-300" : "text-emerald-300"
          }`}
        >
          {banner}
        </div>
      )}

      {/* pb-28 clears the fixed bottom bar (plus the home indicator under it);
          from sm the bar is back at the top and only the old padding applies. */}
      <div className="px-4 pb-28 pt-4 sm:px-8 sm:pb-10 sm:pt-2">
        {view === "dashboard" && <Dashboard />}
        {view === "deadlines" && <Deadlines />}
        {view === "calendar" && <CalendarView />}
        {view === "analytics" && <Analytics />}
      </div>

      {/* Outside the view switch: the orb is the one thing here that isn't
          about the work, so it stays reachable from every tab. */}
      <GrowthOrb />
    </div>
  );
}

export default App;
