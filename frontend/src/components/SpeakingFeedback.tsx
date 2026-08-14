import { Sparkles, Check, CircleAlert as AlertCircle, Lightbulb, Volume2 } from "lucide-react";
import type { AssessmentResult } from "../lib/api";
import { speak } from "../lib/speech";
import type { Theme } from "../theme";

function ScoreBar({ label, score, color, theme }: { label: string; score: number; color: string; theme: Theme }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium" style={{ color: theme.textDim }}>{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.panelBorder }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function SpeakingFeedback({ assessment, theme }: { assessment: AssessmentResult; theme: Theme }) {
  const scoreColor = assessment.overallScore >= 70 ? theme.cyan : assessment.overallScore >= 40 ? theme.gold : theme.coral;

  return (
    <div className="mt-3 pt-3 border-t animate-[fadeIn_0.3s_ease]" style={{ borderColor: theme.panelBorder }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} style={{ color: theme.gold }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.gold }}>AI Coach Feedback</span>
        <span className="ml-auto text-lg font-bold font-mono" style={{ color: scoreColor }}>{assessment.overallScore}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <ScoreBar label="Fluency" score={assessment.fluencyScore} color={theme.cyan} theme={theme} />
        <ScoreBar label="Grammar" score={assessment.grammarScore} color={theme.gold} theme={theme} />
        <ScoreBar label="Vocabulary" score={assessment.vocabularyScore} color={theme.coral} theme={theme} />
      </div>

      {assessment.strengths.length > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.cyan }}>
            <Check size={12} /> Strengths
          </div>
          <ul className="space-y-1">
            {assessment.strengths.map((s, i) => (
              <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: theme.text }}>
                <span className="mt-0.5 shrink-0" style={{ color: theme.cyan }}>·</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.improvements.length > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.coral }}>
            <AlertCircle size={12} /> To work on
          </div>
          <ul className="space-y-1">
            {assessment.improvements.map((s, i) => (
              <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: theme.text }}>
                <span className="mt-0.5 shrink-0" style={{ color: theme.coral }}>·</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.correctedVersion && (
        <div className="mb-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>Corrected version</div>
          <div className="flex items-start gap-2">
            <p className="text-xs italic leading-relaxed flex-1" style={{ color: theme.text }}>"{assessment.correctedVersion}"</p>
            <button onClick={() => speak(assessment.correctedVersion)} className="shrink-0 p-1.5 rounded-lg transition-colors" style={{ backgroundColor: theme.chipBg, color: theme.gold }} aria-label="Listen to correction">
              <Volume2 size={13} />
            </button>
          </div>
        </div>
      )}

      {assessment.tip && (
        <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ backgroundColor: theme.chipBg }}>
          <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: theme.gold }} />
          <p className="text-xs leading-relaxed" style={{ color: theme.textDim }}>{assessment.tip}</p>
        </div>
      )}
    </div>
  );
}
