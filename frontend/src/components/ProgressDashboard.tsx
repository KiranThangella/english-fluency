import { useMemo } from "react";
import { Zap, Award, TrendingUp, Flame, Medal, Mic } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Theme } from "../theme";
import type { ProgressState } from "../lib/api";

function LevelRing({ level, progress, theme }: { level: number; progress: number; theme: Theme }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={theme.panelBorder} strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={theme.cyan} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.7s ease", filter: `drop-shadow(0 0 6px ${theme.cyan}90)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono" style={{ color: theme.text }}>{level}</span>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: theme.textDim }}>Level</span>
      </div>
    </div>
  );
}

export default function ProgressDashboard({
  completedDays, speakScores, sessions, streak, theme,
}: {
  completedDays: number[]; speakScores: Record<string, number>;
  sessions: ProgressState["sessions"]; streak: number; theme: Theme;
}) {
  const totalXp = completedDays.length * 20 + Object.values(speakScores).filter((s) => s >= 70).length * 5;
  const level = Math.floor(totalXp / 150) + 1;
  const levelProgress = (totalXp % 150) / 150;

  const scoreTrend = useMemo(() => {
    const map: Record<number, number[]> = {};
    Object.entries(speakScores).forEach(([key, score]) => {
      const day = parseInt(key.split("-")[0], 10);
      if (!map[day]) map[day] = [];
      map[day].push(score);
    });
    return Object.keys(map).map(Number).sort((a, b) => a - b).map((day) => ({
      day: `D${day}`, score: Math.round(map[day].reduce((a, b) => a + b, 0) / map[day].length),
    }));
  }, [speakScores]);

  const wpmTrend = useMemo(() => sessions.map((s, i) => ({ session: `#${i + 1}`, wpm: s.wpm })), [sessions]);
  const avgAccuracy = scoreTrend.length ? Math.round(scoreTrend.reduce((a, b) => a + b.score, 0) / scoreTrend.length) : 0;

  const weeklyDelta = useMemo(() => {
    if (scoreTrend.length < 2) return null;
    const half = Math.ceil(scoreTrend.length / 2);
    const firstHalf = scoreTrend.slice(0, half);
    const secondHalf = scoreTrend.slice(half);
    if (!secondHalf.length) return null;
    const avg = (arr: typeof scoreTrend) => Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length);
    return avg(secondHalf) - avg(firstHalf);
  }, [scoreTrend]);

  const badges = useMemo(() => {
    const b: Array<{ label: string; icon: typeof Flame }> = [];
    if (streak >= 7) b.push({ label: "7-Day Streak", icon: Flame });
    if (streak >= 30) b.push({ label: "30-Day Streak", icon: Flame });
    if (Object.keys(speakScores).length >= 50) b.push({ label: "50 Phrases Spoken", icon: Mic });
    if (level >= 5) b.push({ label: `Level ${level} Reached`, icon: Zap });
    if (completedDays.includes(30)) b.push({ label: "Beginner Complete", icon: Medal });
    if (completedDays.filter((d) => d >= 31 && d <= 45).length >= 15) b.push({ label: "Intermediate Complete", icon: Medal });
    if (completedDays.filter((d) => d >= 46 && d <= 60).length >= 15) b.push({ label: "Advanced Complete", icon: Award });
    return b;
  }, [streak, speakScores, level, completedDays]);

  const tooltipStyle = { background: theme.mode === "dark" ? "#111B33" : "#FFFFFF", border: `1px solid ${theme.panelBorder}`, borderRadius: 10, fontSize: 12, color: theme.text };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border backdrop-blur-xl p-5 sm:p-6 flex items-center gap-6" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
        <LevelRing level={level} progress={levelProgress} theme={theme} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: theme.cyan }}><Zap size={13} /> {totalXp} XP</div>
          <p className="text-xs mb-3" style={{ color: theme.textDim }}>{150 - (totalXp % 150)} XP to level {level + 1}</p>
          <div className="grid grid-cols-3 gap-3">
            <div><div className="text-lg font-bold font-mono" style={{ color: theme.text }}>{completedDays.length}</div><div className="text-[10px] uppercase tracking-wide" style={{ color: theme.textDim }}>Days done</div></div>
            <div><div className="text-lg font-bold font-mono flex items-center gap-1" style={{ color: theme.text }}><Flame size={14} style={{ color: theme.coral }} />{streak}</div><div className="text-[10px] uppercase tracking-wide" style={{ color: theme.textDim }}>Streak</div></div>
            <div><div className="text-lg font-bold font-mono" style={{ color: theme.text }}>{avgAccuracy}%</div><div className="text-[10px] uppercase tracking-wide" style={{ color: theme.textDim }}>Avg accuracy</div></div>
          </div>
        </div>
      </div>

      {weeklyDelta !== null && (
        <div className="rounded-2xl border backdrop-blur-xl p-4 flex items-center gap-3" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <TrendingUp size={18} style={{ color: weeklyDelta >= 0 ? theme.cyan : theme.coral }} />
          <p className="text-sm" style={{ color: theme.text }}>
            Your accuracy has {weeklyDelta >= 0 ? "improved" : "dipped"} by <span className="font-mono font-semibold">{Math.abs(weeklyDelta)}%</span> comparing your first and second half of practice so far.
          </p>
        </div>
      )}

      {badges.length > 0 && (
        <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gold }}><Medal size={14} /> Badges</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b, i) => {
              const Icon = b.icon;
              return <span key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: theme.chipBg, border: `1px solid ${theme.chipBorder}`, color: theme.text }}><Icon size={12} style={{ color: theme.gold }} /> {b.label}</span>;
            })}
          </div>
        </div>
      )}

      <div className="rounded-3xl border backdrop-blur-xl p-5" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: theme.gold }}><Award size={14} /> Speaking accuracy over time</div>
        {scoreTrend.length ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.panelBorder} />
              <XAxis dataKey="day" stroke={theme.textDim} fontSize={11} tickLine={false} />
              <YAxis stroke={theme.textDim} fontSize={11} domain={[0, 100]} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="score" stroke={theme.gold} strokeWidth={2} dot={{ r: 3, fill: theme.gold }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-xs" style={{ color: theme.textDim }}>Practice a few "Say it back" phrases to see your trend here.</p>}
      </div>

      <div className="rounded-3xl border backdrop-blur-xl p-5" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: theme.cyan }}><TrendingUp size={14} /> Speaking pace (words/min)</div>
        {wpmTrend.length ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={wpmTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.panelBorder} />
              <XAxis dataKey="session" stroke={theme.textDim} fontSize={11} tickLine={false} />
              <YAxis stroke={theme.textDim} fontSize={11} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="wpm" stroke={theme.cyan} strokeWidth={2} dot={{ r: 3, fill: theme.cyan }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-xs" style={{ color: theme.textDim }}>Complete a Free-Speak Challenge to start tracking your pace.</p>}
      </div>
    </div>
  );
}
