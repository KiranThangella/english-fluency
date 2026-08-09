import { useState } from "react";
import { Volume2, Mic, MicOff, AlertTriangle } from "lucide-react";
import { diffWords, getSpeechRecognition, speak, type DiffResult } from "../lib/speech";
import type { Theme } from "../theme";

export default function SpeakCard({
  target, onResult, savedScore, theme,
}: { target: string; onResult?: (diff: DiffResult) => void; savedScore?: number; theme: Theme }) {
  const [status, setStatus] = useState<"idle" | "listening" | "done" | "error">("idle");
  const [result, setResult] = useState<{ transcript: string; diff: DiffResult } | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const supported = !!getSpeechRecognition();

  const start = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    setStatus("listening"); setResult(null);
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      const diff = diffWords(target, transcript);
      setResult({ transcript, diff });
      setStatus("done");
      onResult?.(diff);
    };
    rec.onerror = (e: any) => {
      setStatus("error");
      setErrMsg(e.error === "not-allowed" ? "Microphone access was blocked." : e.error === "no-speech" ? "No speech detected — try again." : "Couldn't hear that clearly.");
    };
    try { rec.start(); } catch { setStatus("error"); setErrMsg("Couldn't start the microphone."); }
  };

  const score = result?.diff.score ?? savedScore ?? null;

  return (
    <div className="rounded-2xl border backdrop-blur-xl p-4 transition-colors" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm sm:text-[15px] leading-snug" style={{ color: theme.text }}>{target}</p>
        <button onClick={() => speak(target)} className="shrink-0 p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.chipBg, color: theme.gold }} aria-label="Listen">
          <Volume2 size={15} />
        </button>
      </div>
      {!supported ? (
        <p className="text-xs flex items-center gap-1.5" style={{ color: theme.textDim }}><AlertTriangle size={13} /> Needs Chrome or Edge for speech scoring.</p>
      ) : (
        <div className="flex items-center gap-2.5">
          <button
            onClick={start}
            disabled={status === "listening"}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 hover:scale-105"
            style={{ backgroundColor: status === "listening" ? theme.coral : theme.gold, color: status === "listening" ? theme.onCoral : theme.onGold }}
          >
            {status === "listening" ? <MicOff size={13} /> : <Mic size={13} />}
            {status === "listening" ? "Listening…" : score !== null ? "Try again" : "Speak it"}
          </button>
          {score !== null && <span className="text-xs font-semibold font-mono" style={{ color: score >= 70 ? theme.cyan : theme.textDim }}>{score}% match</span>}
        </div>
      )}
      {status === "error" && <p className="text-xs mt-2" style={{ color: theme.coral }}>{errMsg}</p>}
      {result && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-1 animate-[fadeIn_0.3s_ease]" style={{ borderColor: theme.panelBorder }}>
          {result.diff.tokens.map((t, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={t.matched ? { color: theme.cyan, backgroundColor: `${theme.cyan}1A` } : { color: theme.coral, backgroundColor: `${theme.coral}1A`, textDecoration: "line-through" }}>{t.word}</span>
          ))}
        </div>
      )}
    </div>
  );
}
