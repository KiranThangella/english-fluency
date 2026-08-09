import { useEffect, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { fetchLeaderboard, updateLeaderboardSettings, type LeaderboardEntry, type AuthUser } from "../lib/api";
import type { Theme } from "../theme";

export default function Leaderboard({ theme, user, onUserUpdate }: { theme: Theme; user: AuthUser; onUserUpdate: (patch: Partial<AuthUser>) => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [nickname, setNickname] = useState(user.nickname ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchLeaderboard();
      setEntries(data.entries);
      setMyRank(data.myRank);
    } catch {
      // leaderboard is a nice-to-have — fail quietly
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const joinLeaderboard = async () => {
    if (saving || !nickname.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await updateLeaderboardSettings(nickname.trim(), true);
      onUserUpdate({ nickname: res.nickname, leaderboardOptIn: res.leaderboardOptIn });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the leaderboard.");
    } finally { setSaving(false); }
  };

  const leaveLeaderboard = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateLeaderboardSettings(nickname.trim(), false);
      onUserUpdate({ leaderboardOptIn: res.leaderboardOptIn });
      await load();
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gold }}>
        <Trophy size={14} /> Leaderboard
      </div>

      {!user.leaderboardOptIn ? (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: theme.textDim }}>
            Opt in to show your XP on a public leaderboard under a nickname — no email, no real name. You can leave anytime.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Pick a nickname"
              maxLength={20}
              className="flex-1 rounded-full px-3.5 py-2 text-sm border focus:outline-none"
              style={{ backgroundColor: theme.input, borderColor: theme.panelBorder, color: theme.text }}
            />
            <button onClick={joinLeaderboard} disabled={!nickname.trim() || saving} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold disabled:opacity-30" style={{ backgroundColor: theme.gold, color: theme.onGold }}>
              <Users size={13} /> {saving ? "…" : "Join"}
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: theme.coral }}>{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs" style={{ color: theme.textDim }}>
            Playing as <span style={{ color: theme.text, fontWeight: 600 }}>{user.nickname}</span>
            {myRank && <> · Rank <span style={{ color: theme.gold, fontWeight: 600 }}>#{myRank}</span></>}
          </p>
          <button onClick={leaveLeaderboard} disabled={saving} className="text-xs underline disabled:opacity-50" style={{ color: theme.textDim }}>Leave</button>
        </div>
      )}

      {loading ? (
        <p className="text-xs mt-3" style={{ color: theme.textDim }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs mt-3" style={{ color: theme.textDim }}>No one's opted in yet — be the first.</p>
      ) : (
        <ol className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: theme.panelBorder }}>
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span style={{ color: theme.text }}>
                <span style={{ color: theme.textDim, fontFamily: "monospace" }}>{String(i + 1).padStart(2, "0")}</span>{"  "}{e.nickname}
              </span>
              <span style={{ color: theme.gold, fontWeight: 600 }}>{e.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
