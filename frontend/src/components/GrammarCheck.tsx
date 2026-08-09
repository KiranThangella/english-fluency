import { useState } from "react";
import { SpellCheck2, Wand2 } from "lucide-react";
import { checkGrammar } from "../lib/api";
import type { Theme } from "../theme";

export default function GrammarCheck({ theme, onXp }: { theme: Theme; onXp?: (xp: number) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const check = async () => {
    const sentence = text.trim();
    if (!sentence || loading) return;
    setLoading(true); setResult(null);
    try {
      const { result: res, xp } = await checkGrammar(sentence);
      setResult(res);
      onXp?.(xp);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gold }}><SpellCheck2 size={14} /> Check your own sentence</div>
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Write any English sentence you're unsure about…"
          className="flex-1 rounded-full px-3.5 py-2 text-sm border focus:outline-none"
          style={{ backgroundColor: theme.input, borderColor: theme.panelBorder, color: theme.text }}
        />
        <button onClick={check} disabled={!text.trim() || loading} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold disabled:opacity-30 transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.gold, color: theme.onGold }}>
          <Wand2 size={13} /> {loading ? "…" : "Check"}
        </button>
      </div>
      {result && <p className="text-sm mt-3 pt-3 border-t leading-relaxed whitespace-pre-line" style={{ borderColor: theme.panelBorder, color: theme.text }}>{result}</p>}
    </div>
  );
}
