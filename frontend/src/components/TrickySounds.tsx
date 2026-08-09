import { useState } from "react";
import { Waves } from "lucide-react";
import { TRICKY_SOUNDS, LEVELS } from "../data/content";
import SpeakCard from "./SpeakCard";
import type { Theme } from "../theme";

export default function TrickySounds({ theme }: { theme: Theme }) {
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const groups = TRICKY_SOUNDS.filter((s) => s.level === level);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: theme.textDim }}>Sounds Telugu speakers often merge — English keeps them distinct. Listen first, then say it, then check your match.</p>

      <div className="flex gap-2">
        {LEVELS.map((lvl) => {
          const active = level === lvl.id;
          const color = theme[lvl.color];
          const onColor = lvl.color === "gold" ? theme.onGold : lvl.color === "coral" ? theme.onCoral : theme.onCyan;
          return (
            <button
              key={lvl.id}
              onClick={() => setLevel(lvl.id)}
              className="flex-1 py-2 rounded-full text-xs font-semibold border transition-colors"
              style={active ? { backgroundColor: color, color: onColor, borderColor: color } : { backgroundColor: theme.chipBg, color: theme.textDim, borderColor: theme.panelBorder }}
            >
              {lvl.label}
            </button>
          );
        })}
      </div>

      {groups.map((s, i) => (
        <div key={i} className="rounded-3xl border backdrop-blur-xl p-4 sm:p-5" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.gold }}><Waves size={14} /> {s.category}</div>
          <p className="text-xs mb-3" style={{ color: theme.textDim }}>{s.note}</p>
          <div className="space-y-2">{s.targets.map((t, j) => <SpeakCard key={j} target={t} theme={theme} />)}</div>
        </div>
      ))}
    </div>
  );
}
