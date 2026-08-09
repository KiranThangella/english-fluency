import { Check } from "lucide-react";
import type { Theme } from "../theme";

export default function Stone({
  day, completed, current, onClick, theme,
}: { day: number; completed: boolean; current: boolean; onClick: () => void; theme: Theme }) {
  const style = completed
    ? { backgroundColor: theme.gold, borderColor: theme.gold, color: theme.onGold, boxShadow: `0 0 16px ${theme.gold}70` }
    : current
    ? { backgroundColor: theme.coral, borderColor: theme.coral, color: theme.onCoral, boxShadow: `0 0 16px ${theme.coral}60`, transform: "scale(1.1)" }
    : { backgroundColor: "transparent", borderColor: theme.panelBorder, color: theme.textDim };

  return (
    <button onClick={onClick} className="group relative flex flex-col items-center shrink-0 focus:outline-none" style={{ width: 54 }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold font-mono border-2 transition-all duration-300" style={style}>
        {completed ? <Check size={16} strokeWidth={3} /> : day}
      </div>
      <span className="mt-1 text-[10px] font-mono" style={{ color: theme.textDim }}>D{day}</span>
    </button>
  );
}
