import { useState } from "react";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { Analytics } from "./pages/Analytics";

type View = "dashboard" | "analytics";

function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="min-h-screen">
      <nav className="sticky top-4 z-30 mx-auto mb-2 flex w-fit items-center gap-1 rounded-full glass p-1 px-1.5">
        <button
          onClick={() => setView("dashboard")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all
            ${
              view === "dashboard"
                ? "bg-white text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
        >
          <LayoutDashboard size={15} /> Board
        </button>
        <button
          onClick={() => setView("analytics")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all
            ${
              view === "analytics"
                ? "bg-white text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
        >
          <BarChart3 size={15} /> Insights
        </button>
      </nav>
      <div className="px-4 pb-10 pt-2 sm:px-8">{view === "dashboard" ? <Dashboard /> : <Analytics />}</div>
    </div>
  );
}

export default App;
