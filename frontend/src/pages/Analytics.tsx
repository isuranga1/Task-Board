import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "../api/client";
import type { AnalyticsSummary, Section } from "../types";

const STATUS_COLORS: Record<string, string> = {
  todo: "#7c8cff",
  in_progress: "#ff9f6b",
  done: "#4ee1a0",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#a1a1aa",
  medium: "#7dd3fc",
  high: "#fb923c",
  urgent: "#fb7185",
};

const chartTooltipStyle = {
  background: "rgba(22, 22, 28, 0.9)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  backdropFilter: "blur(12px)",
};

export function Analytics() {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState<number | "all">("all");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSections().then(setSections).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAnalytics(sectionId === "all" ? undefined : sectionId)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [sectionId]);

  if (loading && !summary) {
    return <p className="text-zinc-400">Loading your insights…</p>;
  }

  if (error) {
    return <p className="text-rose-300 text-sm">{error}</p>;
  }

  if (!summary) return null;

  const statusData = Object.entries(summary.by_status).map(([status, count]) => ({
    status,
    count,
  }));

  const priorityData = Object.entries(summary.by_priority)
    .filter(([, count]) => count > 0)
    .map(([priority, count]) => ({ name: priority, value: count }));

  const trendData = Object.entries(summary.completed_by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: day.slice(5), count })); // "MM-DD" for compactness

  const subtaskPct =
    summary.subtasks_total > 0
      ? Math.round((summary.subtasks_done / summary.subtasks_total) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Insights</h1>
      </div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-zinc-400 text-sm">A quick look at how things are going.</p>
        <select
          value={sectionId}
          onChange={(e) =>
            setSectionId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="glass rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-white/30"
        >
          <option value="all">Everything</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Top stat cards ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total tasks" value={summary.total_tasks} />
        <StatCard
          label="Completion rate"
          value={`${Math.round(summary.completion_rate * 100)}%`}
          accent="text-emerald-300"
        />
        <StatCard
          label="Overdue"
          value={summary.overdue_count}
          accent={summary.overdue_count > 0 ? "text-rose-300" : undefined}
        />
        <StatCard label="Subtasks done" value={`${subtaskPct}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* ---------- Tasks by status ---------- */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Where things stand</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="status" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ---------- Priority breakdown ---------- */}
        <div className="glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Priority mix</h2>
          {priorityData.length === 0 ? (
            <p className="text-zinc-500 text-sm italic">No tasks yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => entry.name}
                  labelLine={false}
                >
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---------- Completion trend ---------- */}
      <div className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4">
          Finished tasks over time <span className="text-zinc-500 font-normal">(by last-updated date)</span>
        </h2>
        {trendData.length === 0 ? (
          <p className="text-zinc-500 text-sm italic">Nothing completed yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <Bar dataKey="count" fill="#4ee1a0" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
