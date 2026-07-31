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
  todo: "#6366f1",
  in_progress: "#ef4444",
  done: "#22c55e",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#71717a",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
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
    return <p className="text-zinc-500">Loading analytics…</p>;
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <select
          value={sectionId}
          onChange={(e) =>
            setSectionId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
        >
          <option value="all">All sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Top stat cards ---------- */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total tasks" value={summary.total_tasks} />
        <StatCard
          label="Completion rate"
          value={`${Math.round(summary.completion_rate * 100)}%`}
          accent="text-emerald-400"
        />
        <StatCard
          label="Overdue"
          value={summary.overdue_count}
          accent={summary.overdue_count > 0 ? "text-red-400" : undefined}
        />
        <StatCard label="Subtasks done" value={`${subtaskPct}%`} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* ---------- Tasks by status ---------- */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Tasks by status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="status" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ---------- Priority breakdown ---------- */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Priority breakdown</h2>
          {priorityData.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No tasks yet.</p>
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
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---------- Completion trend ---------- */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">
          Tasks completed by day <span className="text-zinc-600">(by last-updated date)</span>
        </h2>
        {trendData.length === 0 ? (
          <p className="text-zinc-600 text-sm italic">Nothing completed yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
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
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
