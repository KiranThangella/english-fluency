import { useState } from "react";
import { Headphones, Volume2, Keyboard, Shuffle } from "lucide-react";
import { diffWords, speak, type DiffResult } from "../lib/speech";
import { DICTATION_BANK, LEVELS } from "../data/content";
import type { Theme } from "../theme";

export default function DictationDrill({ theme }: { theme: Theme }) {
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const sentences = DICTATION_BANK.find((b) => b.level === level)!.sentences;
  const [index, setIndex] = useState(0);
  const target = sentences[index % sentences.length];

  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<DiffResult | null>(null);
  const check = () => setResult(diffWords(target, typed));

  const nextSentence = () => {
    setIndex((i) => (i + 1) % sentences.length);
    setRevealed(false); setTyped(""); setResult(null);
  };

  const changeLevel = (lvl: "beginner" | "intermediate" | "advanced") => {
    setLevel(lvl); setIndex(0); setRevealed(false); setTyped(""); setResult(null);
  };

  return (
    <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.cyan }}><Headphones size={14} /> Listen &amp; Type</div>

      <div className="flex gap-2 mb-3">
        {LEVELS.map((lvl) => {
          const active = level === lvl.id;
          const color = theme[lvl.color];
          const onColor = lvl.color === "gold" ? theme.onGold : lvl.color === "coral" ? theme.onCoral : theme.onCyan;
          return (
            <button key={lvl.id} onClick={() => changeLevel(lvl.id)} className="flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={active ? { backgroundColor: color, color: onColor, borderColor: color } : { backgroundColor: theme.chipBg, color: theme.textDim, borderColor: theme.panelBorder }}>
              {lvl.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => speak(target)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.chipBg, color: theme.cyan }}>
          <Volume2 size={13} /> Play sentence
        </button>
        <button onClick={() => setRevealed((r) => !r)} className="text-xs underline underline-offset-2" style={{ color: theme.textDim }}>{revealed ? "Hide text" : "Stuck? Reveal"}</button>
        <button onClick={nextSentence} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: theme.chipBg, color: theme.gold }}>
          <Shuffle size={12} /> Next
        </button>
      </div>
      {revealed && <p className="text-xs italic mb-3" style={{ color: theme.textDim }}>"{target}"</p>}
      <div className="flex items-center gap-2">
        <Keyboard size={14} className="shrink-0" style={{ color: theme.textDim }} />
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Type what you heard…"
          className="flex-1 rounded-full px-3.5 py-2 text-sm border focus:outline-none"
          style={{ backgroundColor: theme.input, borderColor: theme.panelBorder, color: theme.text }}
        />
        <button onClick={check} disabled={!typed.trim()} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold disabled:opacity-30 transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.cyan, color: theme.onCyan }}>
          Check
        </button>
      </div>
      {result && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.panelBorder }}>
          <span className="text-xs font-mono font-semibold" style={{ color: result.score >= 70 ? theme.cyan : theme.textDim }}>{result.score}% accurate</span>
          <div className="flex flex-wrap gap-1 mt-2">
            {result.tokens.map((t, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={t.matched ? { color: theme.cyan, backgroundColor: `${theme.cyan}1A` } : { color: theme.coral, backgroundColor: `${theme.coral}1A`, textDecoration: "line-through" }}>{t.word}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
