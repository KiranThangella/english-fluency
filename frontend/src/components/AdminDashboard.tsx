import { useEffect, useState } from "react";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "../lib/api";
import type { Theme } from "../theme";

function Card({ label, value, theme }: { label: string; value: string | number; theme: Theme }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: theme.text }}>{value}</div>
    </div>
  );
}

export default function AdminDashboard({ theme }: { theme: Theme }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsSummary()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: theme.bg, color: theme.coral }}>{error}</div>;
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.bg, color: theme.textDim }}>Loading…</div>;
  }

  const maxDaily = Math.max(1, ...data.activeUsersLast14Days.map((d) => d.count), ...data.signupsLast14Days.map((d) => d.count));

  return (
    <div className="min-h-screen px-5 py-8" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-bold">Analytics</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card theme={theme} label="Total users" value={data.totalUsers} />
          <Card theme={theme} label="Free / Premium" value={`${data.freeUsers} / ${data.premiumUsers}`} />
          <Card theme={theme} label="Verified" value={data.verifiedUsers} />
          <Card theme={theme} label="Leaderboard opt-ins" value={data.leaderboardOptIns} />
          <Card theme={theme} label="Day 1 retention" value={data.day1Retention !== null ? `${data.day1Retention}%` : "—"} />
          <Card theme={theme} label="Day 7 retention" value={data.day7Retention !== null ? `${data.day7Retention}%` : "—"} />
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.textDim }}>Signups &amp; active users — last 14 days</div>
          <div className="flex items-end gap-1 h-24">
            {data.signupsLast14Days.length === 0 && data.activeUsersLast14Days.length === 0 && (
              <span className="text-xs" style={{ color: theme.textDim }}>No data yet.</span>
            )}
            {Array.from(new Set([...data.signupsLast14Days.map((d) => d.day), ...data.activeUsersLast14Days.map((d) => d.day)])).sort().map((day) => {
              const signups = data.signupsLast14Days.find((d) => d.day === day)?.count ?? 0;
              const active = data.activeUsersLast14Days.find((d) => d.day === day)?.count ?? 0;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-0.5 justify-end h-full" title={`${day}: ${signups} signups, ${active} active`}>
                  <div className="w-full rounded-t" style={{ height: `${(active / maxDaily) * 60}%`, backgroundColor: theme.cyan, minHeight: active ? 2 : 0 }} />
                  <div className="w-full rounded-t" style={{ height: `${(signups / maxDaily) * 60}%`, backgroundColor: theme.gold, minHeight: signups ? 2 : 0 }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px]" style={{ color: theme.textDim }}>
            <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: theme.gold }} />Signups</span>
            <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: theme.cyan }} />Active users</span>
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="text-xs uppercase tracking-wide mb-3" style={{ color: theme.textDim }}>Event counts — last 30 days</div>
          {data.eventCountsLast30Days.length === 0 ? (
            <span className="text-xs" style={{ color: theme.textDim }}>No events yet.</span>
          ) : (
            <div className="space-y-1.5">
              {data.eventCountsLast30Days.map((e) => (
                <div key={e.eventType} className="flex items-center justify-between text-sm">
                  <span style={{ color: theme.text }}>{e.eventType}</span>
                  <span style={{ color: theme.gold, fontWeight: 600 }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
