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
    <div className="min-h-screen">
      <nav className="glass sticky top-4 z-30 mx-auto mb-2 flex w-fit items-center gap-1 rounded-full p-1 px-1.5">
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all
              ${v === view ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}
          >
            <Icon size={15} /> {label}
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

      <div className="px-4 pb-10 pt-2 sm:px-8">
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
