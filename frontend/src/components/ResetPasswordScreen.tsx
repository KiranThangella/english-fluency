import { useState } from "react";
import { Lock, AlertTriangle } from "lucide-react";
import { resetPassword, type AuthUser } from "../lib/api";
import type { Theme } from "../theme";

export default function ResetPasswordScreen({ theme, token, onDone }: { theme: Theme; token: string; onDone: (user: AuthUser) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading || password.length < 8) return;
    setLoading(true); setError(null);
    try {
      const user = await resetPassword(token, password);
      onDone(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="w-full max-w-sm rounded-3xl border p-6 sm:p-8" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.gold }}>
          <Lock size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase font-mono">Set a new password</span>
        </div>
        <h1 className="text-2xl font-bold mb-5" style={{ fontFamily: "ui-serif, Georgia, serif" }}>English Fluency Trail</h1>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.chipBorder, backgroundColor: theme.input }}>
            <Lock size={14} style={{ color: theme.textDim }} />
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: theme.text }}
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: theme.coral }}>
              <AlertTriangle size={12} /> {error}
            </p>
          )}
          <button type="submit" disabled={loading || password.length < 8} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50" style={{ backgroundColor: theme.gold, color: theme.onGold }}>
            {loading ? "Please wait…" : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
