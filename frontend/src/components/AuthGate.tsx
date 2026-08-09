import { useState } from "react";
import { Lock, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { login, signup, forgotPassword, type AuthUser } from "../lib/api";
import type { Theme } from "../theme";

type Mode = "login" | "signup" | "forgot";

export default function AuthGate({ theme, onAuthed }: { theme: Theme; onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError(null); setMessage(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const msg = await forgotPassword(email);
        setMessage(msg);
      } else {
        const user = mode === "login" ? await login(email, password) : await signup(email, password);
        onAuthed(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => { setMode(m); setError(null); setMessage(null); };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="w-full max-w-sm rounded-3xl border p-6 sm:p-8" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: theme.gold }}>
          <Lock size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase font-mono">
            {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-5" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          English Fluency Trail
        </h1>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.chipBorder, backgroundColor: theme.input }}>
            <Mail size={14} style={{ color: theme.textDim }} />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: theme.text }}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.chipBorder, backgroundColor: theme.input }}>
              <Lock size={14} style={{ color: theme.textDim }} />
              <input
                type="password"
                placeholder={mode === "signup" ? "At least 8 characters" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: theme.text }}
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
            </div>
          )}

          {error && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: theme.coral }}>
              <AlertTriangle size={12} /> {error}
            </p>
          )}
          {message && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: theme.cyan }}>
              <CheckCircle2 size={12} /> {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: theme.gold, color: theme.onGold }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        {mode === "login" && (
          <button onClick={() => switchMode("forgot")} className="w-full text-center text-xs mt-4" style={{ color: theme.textDim }}>
            Forgot password?
          </button>
        )}

        <button
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-xs mt-2"
          style={{ color: theme.textDim }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : mode === "forgot" ? "Back to sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
