import { useState } from "react";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { Analytics } from "./pages/Analytics";

type View = "dashboard" | "analytics";

function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-1 px-8 pt-6">
        <button
          onClick={() => setView("dashboard")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${view === "dashboard" ? "bg-[var(--color-surface)] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <LayoutDashboard size={14} /> Dashboard
        </button>
        <button
          onClick={() => setView("analytics")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors
            ${view === "analytics" ? "bg-[var(--color-surface)] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <BarChart3 size={14} /> Analytics
        </button>
      </nav>
      <div className="p-8 pt-4">{view === "dashboard" ? <Dashboard /> : <Analytics />}</div>
    </div>
  );
}

export default App;
