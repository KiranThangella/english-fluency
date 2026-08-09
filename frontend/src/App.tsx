import { useState, useEffect, useMemo } from "react";
import {
  Check, Flame, MapPin, Volume2, BookOpen, MessageCircle, Lightbulb,
  ChevronDown, ChevronUp, Mic, Sparkles, AlertTriangle, Ear, Route,
  PartyPopper, TrendingUp, Sun, Moon, Lock, Zap,
} from "lucide-react";
import { DARK, LIGHT } from "./theme";
import { WEEKS, DAY_CONTENT, TOTAL_DAYS, LEVELS, levelForDay } from "./data/content";
import { getSpeechRecognition, speak, type DiffResult } from "./lib/speech";
import {
  fetchProgress, saveProgress as persistProgress, type ProgressState,
  fetchMe, logout as apiLogout, billingStatus, startCheckout, type AuthUser,
  verifyEmail, resendVerification,
} from "./lib/api";
import NebulaBackground from "./components/NebulaBackground";
import Stone from "./components/Stone";
import SpeakCard from "./components/SpeakCard";
import DictationDrill from "./components/DictationDrill";
import FreeSpeakChallenge from "./components/FreeSpeakChallenge";
import GrammarCheck from "./components/GrammarCheck";
import ChatPractice from "./components/ChatPractice";
import TrickySounds from "./components/TrickySounds";
import ProgressDashboard from "./components/ProgressDashboard";
import Leaderboard from "./components/Leaderboard";
import AuthGate from "./components/AuthGate";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import AdminDashboard from "./components/AdminDashboard";

const TABS = [
  { id: "trail", label: "Trail", icon: Route },
  { id: "talk", label: "Talk", icon: MessageCircle },
  { id: "sounds", label: "Sounds", icon: Ear },
  { id: "progress", label: "Progress", icon: TrendingUp },
] as const;

type TabId = typeof TABS[number]["id"];

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const theme = darkMode ? DARK : LIGHT;
  const [tab, setTab] = useState<TabId>("trail");
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [speakScores, setSpeakScores] = useState<Record<string, number>>({});
  const [weakWords, setWeakWords] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<ProgressState["sessions"]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const speechSupported = !!getSpeechRecognition();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  // Read one-time tokens from the URL (email links land here) — captured
  // once on first render, then the URL is cleaned so a refresh doesn't
  // re-trigger verification or re-show the reset screen.
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const [verifyPending, setVerifyPending] = useState(() => new URLSearchParams(window.location.search).get("verify"));
  const [isAdminView] = useState(() => new URLSearchParams(window.location.search).get("admin") === "1");

  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!verifyPending) return;
    verifyEmail(verifyPending)
      .then(() => {
        setUser((u) => (u ? { ...u, emailVerified: true } : u));
        setToast("Email verified!");
      })
      .catch(() => setToast("That verification link is invalid or expired."))
      .finally(() => setVerifyPending(null));
  }, [verifyPending]);

  const handleResendVerification = async () => {
    if (resendingVerify) return;
    setResendingVerify(true);
    try {
      await resendVerification();
      setToast("Verification email sent — check your inbox.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Couldn't send verification email.");
    } finally { setResendingVerify(false); }
  };

  const loadProgress = async () => {
    try {
      const state = await fetchProgress();
      setCompletedDays(state.completedDays ?? []);
      setSelectedDay(state.selectedDay ?? 1);
      setSpeakScores(state.speakScores ?? {});
      setWeakWords(state.weakWords ?? {});
      setSessions(state.sessions ?? []);
      setDarkMode(state.darkMode ?? true);
    } catch {
      // backend not reachable yet — carry on with defaults
    } finally { setLoaded(true); }
  };

  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setUser(me);
      setAuthChecked(true);
      if (me) await loadProgress(); else setLoaded(true);
    })();
    billingStatus().then((s) => setBillingConfigured(s.configured)).catch(() => {});
  }, []);

  const handleAuthed = async (u: AuthUser) => {
    setUser(u);
    setLoaded(false);
    await loadProgress();
  };

  const handleSignOut = () => {
    apiLogout();
    setUser(null);
    setCompletedDays([]); setSpeakScores({}); setWeakWords({}); setSessions([]); setSelectedDay(1);
  };

  const handleUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch {
      setToast("Couldn't start checkout — try again.");
      setUpgrading(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const persist = async (patch: Partial<ProgressState>) => {
    try {
      const saved = await persistProgress(patch);
      if (typeof saved.xp === "number") setUser((u) => (u ? { ...u, xp: saved.xp as number } : u));
    } catch { setSaveError(true); }
  };

  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); persist({ darkMode: next }); };

  const toggleComplete = (day: number) => {
    const wasCompleted = completedDays.includes(day);
    const next = wasCompleted ? completedDays.filter((d) => d !== day) : [...completedDays, day];
    setCompletedDays(next);
    if (!wasCompleted) setToast(`Day ${day} complete!`);
    persist({ completedDays: next });
  };

  const handleSpeakResult = (day: number, idx: number, diff: DiffResult) => {
    const key = `${day}-${idx}`;
    const nextScores = { ...speakScores, [key]: diff.score };
    setSpeakScores(nextScores);
    const nextWeak = { ...weakWords };
    diff.missed.forEach((w) => { nextWeak[w] = (nextWeak[w] || 0) + 1; });
    setWeakWords(nextWeak);

    const targets = DAY_CONTENT[day - 1].speakTargets;
    const scoresForDay = targets.map((_, i) => nextScores[`${day}-${i}`]);
    const passedCount = scoresForDay.filter((s) => s >= 70).length;
    let nextCompleted = completedDays;
    if (passedCount >= Math.min(2, targets.length) && !completedDays.includes(day)) {
      nextCompleted = [...completedDays, day];
      setCompletedDays(nextCompleted);
      setToast(`Day ${day} complete!`);
    }
    persist({ speakScores: nextScores, weakWords: nextWeak, completedDays: nextCompleted });
  };

  const handleSessionComplete = (day: number, metricsObj: { wpm: number; fillers: number; wordCount: number }) => {
    const nextSessions = [...sessions, { day, ...metricsObj, ts: Date.now() }];
    setSessions(nextSessions);
    persist({ sessions: nextSessions });
  };

  const goToDay = (day: number) => {
    if (day < 1 || day > TOTAL_DAYS) return;
    setSelectedDay(day);
    persist({ selectedDay: day });
    const week = WEEKS.find((w) => {
      const [start, end] = w.range.replace("Days ", "").split("–").map((n) => parseInt(n, 10));
      return day >= start && day <= end;
    });
    if (week) setExpandedWeek(week.id);
  };

  const streak = useMemo(() => {
    let s = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) { if (completedDays.includes(d)) s++; else if (d <= selectedDay) break; }
    return s;
  }, [completedDays, selectedDay]);

  const topWeakWords = useMemo(
    () => Object.entries(weakWords).filter(([w]) => w.length > 2).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [weakWords]
  );

  const content = DAY_CONTENT[selectedDay - 1];
  const currentLevel = levelForDay(selectedDay);
  const progressPct = Math.round((completedDays.length / TOTAL_DAYS) * 100);
  const dayScoreCount = content.speakTargets.filter((_, i) => (speakScores[`${selectedDay}-${i}`] ?? 0) >= 70).length;

  const daysInWeek = (week: typeof WEEKS[number]) => {
    const [start, end] = week.range.replace("Days ", "").split("–").map((n) => parseInt(n, 10));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const beginnerDone = completedDays.filter((d) => d >= 1 && d <= 31).length >= 25;
  const intermediateDone = completedDays.filter((d) => d >= 32 && d <= 46).length >= 12;

  if (resetToken) {
    return (
      <ResetPasswordScreen
        theme={theme}
        token={resetToken}
        onDone={async (u) => {
          setUser(u);
          setAuthChecked(true);
          setToast("Password updated.");
          await loadProgress();
          window.location.href = window.location.pathname; // drop ?reset= from the URL
        }}
      />
    );
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK.bg }}><div className="text-sm tracking-widest uppercase font-mono" style={{ color: DARK.cyan }}>Initializing…</div></div>;
  }

  if (!user) {
    return <AuthGate theme={theme} onAuthed={handleAuthed} />;
  }

  if (isAdminView) {
    return <AdminDashboard theme={theme} />;
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK.bg }}><div className="text-sm tracking-widest uppercase font-mono" style={{ color: DARK.cyan }}>Initializing…</div></div>;
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden transition-colors duration-500" style={{ color: theme.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <NebulaBackground theme={theme} />

      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg" style={{ animation: "popIn 0.35s ease", backgroundColor: theme.gold, color: theme.onGold }}>
          <PartyPopper size={15} /> {toast}
        </div>
      )}

      {!user.emailVerified && (
        <div className="px-5 pt-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs" style={{ borderColor: theme.chipBorder, backgroundColor: theme.chipBg, color: theme.textDim }}>
            <span>Verify your email to secure your account and enable password recovery.</span>
            <button onClick={handleResendVerification} disabled={resendingVerify} className="shrink-0 font-semibold underline disabled:opacity-50" style={{ color: theme.gold }}>
              {resendingVerify ? "Sending…" : "Resend link"}
            </button>
          </div>
        </div>
      )}

      <header className="relative px-5 pt-10 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-mono" style={{ color: theme.cyan }}><MapPin size={13} /><span>69-Day Trail</span></div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: theme.chipBg, color: theme.gold, border: `1px solid ${theme.chipBorder}` }}>
                <Zap size={11} /> {user.xp} XP
              </span>
              {billingConfigured && user.plan === "free" && (
                <button onClick={handleUpgrade} disabled={upgrading} className="px-3 py-2 rounded-full text-xs font-semibold transition-opacity disabled:opacity-50" style={{ backgroundColor: theme.gold, color: theme.onGold }}>
                  {upgrading ? "…" : "Upgrade"}
                </button>
              )}
              {user.plan === "premium" && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: theme.chipBg, color: theme.gold, border: `1px solid ${theme.chipBorder}` }}>Premium</span>
              )}
              <button onClick={handleSignOut} className="px-3 py-2 rounded-full text-xs font-semibold border transition-colors" style={{ borderColor: theme.panelBorder, backgroundColor: theme.chipBg, color: theme.textDim }}>
                Sign out
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-full border transition-colors focus:outline-none focus-visible:ring-2" style={{ borderColor: theme.panelBorder, backgroundColor: theme.chipBg, color: theme.gold }} aria-label="Toggle theme">
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
          <h1 className="text-[30px] leading-[1.1] sm:text-[44px] font-bold mb-3 tracking-tight" style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}>
            English Fluency,<br className="hidden sm:block" /> <span className="shimmer-text bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${theme.gold}, ${theme.coral}, ${theme.cyan})` }}>Beginner to Advanced</span>
          </h1>
          <p className="text-sm sm:text-base max-w-xl leading-relaxed" style={{ color: theme.textDim }}>
            69 days across three levels. You speak, it listens — scored phrases, live AI roleplay, pronunciation drills, and analytics that track your real progress.
          </p>
          {!speechSupported && <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: theme.coral }}><AlertTriangle size={13} /> Open this in Chrome or Edge for live speech scoring.</p>}
          {saveError && <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: theme.coral }}><AlertTriangle size={13} /> Backend not reachable — is it running on port 4000?</p>}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.panelBorder }}>
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%`, backgroundImage: `linear-gradient(90deg, ${theme.gold}, ${theme.cyan})` }} />
            </div>
            <span className="text-sm font-semibold font-mono whitespace-nowrap" style={{ color: theme.gold }}>{completedDays.length}/{TOTAL_DAYS}</span>
          </div>
          {streak > 0 && <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.coral }}><Flame size={14} /><span>{streak}-day streak</span></div>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 relative">
        <div className="flex gap-1.5 p-1.5 rounded-full border mb-8 backdrop-blur-xl" style={{ borderColor: theme.panelBorder, backgroundColor: theme.chipBg }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2"
                style={active ? { backgroundColor: theme.gold, color: theme.onGold, boxShadow: `0 0 14px ${theme.gold}55` } : { color: theme.textDim }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-5 pb-14 relative">
        {tab === "talk" && <ChatPractice theme={theme} onXp={(xp) => setUser((u) => (u ? { ...u, xp } : u))} />}
        {tab === "sounds" && <TrickySounds theme={theme} />}
        {tab === "progress" && (
          <div className="space-y-4">
            <ProgressDashboard completedDays={completedDays} speakScores={speakScores} sessions={sessions} streak={streak} theme={theme} />
            <Leaderboard theme={theme} user={user} onUserUpdate={(patch) => setUser((u) => (u ? { ...u, ...patch } : u))} />
          </div>
        )}

        {tab === "trail" && (
          <>
            <div className="flex gap-2 mb-5">
              {LEVELS.map((lvl) => {
                const locked = lvl.id === "intermediate" ? !beginnerDone : lvl.id === "advanced" ? !intermediateDone : false;
                const activeLvl = currentLevel.id === lvl.id;
                const levelColor = theme[lvl.color];
                const onColor = lvl.color === "gold" ? theme.onGold : lvl.color === "coral" ? theme.onCoral : theme.onCyan;
                return (
                  <button key={lvl.id} onClick={() => !locked && goToDay(lvl.range[0])}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2"
                    style={activeLvl ? { backgroundColor: levelColor, color: onColor, borderColor: levelColor } : { backgroundColor: theme.chipBg, color: locked ? theme.textDim : theme.text, borderColor: theme.chipBorder, opacity: locked ? 0.5 : 1 }}>
                    {locked && <Lock size={11} />} {lvl.label}
                  </button>
                );
              })}
            </div>

            {topWeakWords.length > 0 && (
              <div className="rounded-2xl border backdrop-blur-xl p-4 mb-6" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.gold }}><Sparkles size={14} /> Words worth reviewing</div>
                <div className="flex flex-wrap gap-2">
                  {topWeakWords.map(([w]) => (
                    <button key={w} onClick={() => speak(w)} className="px-2.5 py-1 rounded-md border text-sm transition-colors flex items-center gap-1.5" style={{ backgroundColor: theme.chipBg, borderColor: theme.chipBorder, color: theme.text }}>
                      {w} <Volume2 size={11} style={{ color: theme.textDim }} />
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: theme.textDim }}>Tap to hear them — these are the words your speaking keeps missing.</p>
              </div>
            )}

            <div className="space-y-2.5 mb-8">
              {WEEKS.filter((w) => w.level === currentLevel.id).map((week) => {
                const isOpen = expandedWeek === week.id;
                const wDays = daysInWeek(week);
                const wCompleted = wDays.filter((d) => completedDays.includes(d)).length;
                return (
                  <div key={week.id} className="rounded-2xl border overflow-hidden backdrop-blur-xl" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
                    <button onClick={() => setExpandedWeek(isOpen ? null : week.id)} className="w-full flex items-center justify-between px-4 py-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset">
                      <div className="text-left">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold tracking-wide uppercase font-mono" style={{ color: theme.gold }}>{week.range}</span>
                          <span className="font-semibold" style={{ color: theme.text }}>{week.name}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: theme.textDim }}>{week.blurb}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs font-mono" style={{ color: theme.textDim }}>{wCompleted}/{wDays.length}</span>
                        {isOpen ? <ChevronUp size={16} style={{ color: theme.textDim }} /> : <ChevronDown size={16} style={{ color: theme.textDim }} />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 py-4 border-t flex gap-2 overflow-x-auto" style={{ borderColor: theme.panelBorder }}>
                        {wDays.map((d) => <Stone key={d} day={d} completed={completedDays.includes(d)} current={d === selectedDay} onClick={() => goToDay(d)} theme={theme} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border backdrop-blur-xl p-5 sm:p-8 shadow-xl" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs font-semibold tracking-widest uppercase font-mono" style={{ color: theme.gold }}>Day {selectedDay} · {currentLevel.label}</span>
                  <h2 className="text-xl sm:text-[28px] font-bold mt-1" style={{ fontFamily: "ui-serif, Georgia, serif" }}>{content.title}</h2>
                </div>
                <button onClick={() => toggleComplete(selectedDay)} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2"
                  style={completedDays.includes(selectedDay) ? { backgroundColor: theme.gold, color: theme.onGold } : { backgroundColor: theme.chipBg, color: theme.text }}>
                  <Check size={14} strokeWidth={3} />{completedDays.includes(selectedDay) ? "Completed" : "Mark done"}
                </button>
              </div>

              <div className="space-y-7">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gold }}><Mic size={14} /> Say it back</div>
                    <span className="text-xs font-mono" style={{ color: theme.textDim }}>{dayScoreCount}/{content.speakTargets.length} passed</span>
                  </div>
                  <div className="space-y-2.5">
                    {content.speakTargets.map((t, i) => <SpeakCard key={i} target={t} savedScore={speakScores[`${selectedDay}-${i}`]} onResult={(diff) => handleSpeakResult(selectedDay, i, diff)} theme={theme} />)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: theme.gold }}><BookOpen size={14} /> Reference vocabulary</div>
                  <div className="flex flex-wrap gap-2">
                    {content.vocab.map((v, i) => <span key={i} className="px-2.5 py-1 rounded-md border text-sm" style={{ backgroundColor: theme.chipBg, borderColor: theme.chipBorder, color: theme.text }}>{v}</span>)}
                  </div>
                </div>

                <DictationDrill theme={theme} />
                <FreeSpeakChallenge day={selectedDay} onComplete={handleSessionComplete} theme={theme} />
                <GrammarCheck theme={theme} onXp={(xp) => setUser((u) => (u ? { ...u, xp } : u))} />

                <div className="flex items-start gap-2.5 pt-4 border-t" style={{ borderColor: theme.panelBorder }}>
                  <Lightbulb size={16} className="mt-0.5 shrink-0" style={{ color: theme.gold }} />
                  <p className="text-sm leading-relaxed" style={{ color: theme.textDim }}>{content.tip}</p>
                </div>
              </div>

              <div className="flex justify-between mt-7 pt-6 border-t" style={{ borderColor: theme.panelBorder }}>
                <button disabled={selectedDay === 1} onClick={() => goToDay(selectedDay - 1)} className="text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: theme.textDim }}>← Previous day</button>
                <button disabled={selectedDay === TOTAL_DAYS} onClick={() => goToDay(selectedDay + 1)} className="text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors" style={{ color: theme.textDim }}>Next day →</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
