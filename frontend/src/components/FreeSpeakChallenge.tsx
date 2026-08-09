import { useState, useRef, useEffect, useCallback } from "react";
import { Timer, Mic, MicOff, AlertTriangle, Shuffle } from "lucide-react";
import { FILLER_RE, getSpeechRecognition, normalizeWords } from "../lib/speech";
import { FREE_SPEAK_BANK, LEVELS } from "../data/content";
import type { Theme } from "../theme";

export interface SessionMetrics { wpm: number; fillers: number; wordCount: number; }

export default function FreeSpeakChallenge({
  day, onComplete, theme,
}: {
  day: number; onComplete: (day: number, metrics: SessionMetrics) => void; theme: Theme;
}) {
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const prompts = FREE_SPEAK_BANK.find((b) => b.level === level)!.prompts;
  const [index, setIndex] = useState(0);
  const current = prompts[index % prompts.length];
  const { prompt, vocab, duration } = current;

  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [transcript, setTranscript] = useState("");
  const [timeLeft, setTimeLeft] = useState(duration);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const recRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const timeLeftRef = useRef(duration);
  const supported = !!getSpeechRecognition();

  const setTranscriptBoth = (v: string) => { transcriptRef.current = v; setTranscript(v); };
  const setTimeLeftBoth = (v: number) => { timeLeftRef.current = v; setTimeLeft(v); };

  const stop = useCallback(() => {
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsed = Math.max(1, duration - timeLeftRef.current);
    const wordCount = normalizeWords(transcriptRef.current).length;
    const wpm = Math.round((wordCount / elapsed) * 60);
    const fillers = (transcriptRef.current.match(FILLER_RE) || []).length;
    setMetrics({ wpm, fillers, wordCount });
    setStatus("done");
    onComplete(day, { wpm, fillers, wordCount });
  }, [duration, day, onComplete]);

  const start = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    setTranscriptBoth(""); setTimeLeftBoth(duration); setStatus("recording"); setMetrics(null);
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setTranscriptBoth((finalText + interim).trim());
    };
    rec.onerror = () => {};
    recRef.current = rec;
    try { rec.start(); } catch {}
    timerRef.current = setInterval(() => {
      setTimeLeftBoth(Math.max(0, timeLeftRef.current - 1));
      if (timeLeftRef.current <= 0) stop();
    }, 1000);
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
  }, []);

  const changeLevel = (lvl: "beginner" | "intermediate" | "advanced") => {
    setLevel(lvl); setIndex(0); setStatus("idle"); setTranscriptBoth(""); setMetrics(null);
  };
  const nextPrompt = () => {
    setIndex((i) => (i + 1) % prompts.length);
    setStatus("idle"); setTranscriptBoth(""); setMetrics(null);
  };

  const usedVocab = vocab.filter((v) => {
    const key = v.split(/[\s,]+/)[0].toLowerCase().replace(/[^\w]/g, "");
    return key.length > 2 && transcript.toLowerCase().includes(key);
  });

  return (
    <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.coral }}><Timer size={14} /> Free-Speak Challenge · {duration}s</div>

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

      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm" style={{ color: theme.text }}>{prompt}</p>
        <button onClick={nextPrompt} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: theme.chipBg, color: theme.gold }}>
          <Shuffle size={12} /> New prompt
        </button>
      </div>

      {!supported ? (
        <p className="text-xs flex items-center gap-1.5" style={{ color: theme.textDim }}><AlertTriangle size={13} /> Needs Chrome or Edge for live transcription.</p>
      ) : status !== "recording" ? (
        <button onClick={start} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold hover:scale-105 transition-all focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.gold, color: theme.onGold }}>
          <Mic size={13} /> {status === "done" ? "Speak again" : "Start talking"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button onClick={stop} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: theme.coral, color: theme.onCoral }}><MicOff size={13} /> Stop ({timeLeft}s)</button>
          <span className="text-xs" style={{ color: theme.textDim }}>Keep talking, don't stop…</span>
        </div>
      )}
      {status === "done" && transcript && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.panelBorder }}>
          <p className="text-xs mb-1" style={{ color: theme.textDim }}>What you actually said:</p>
          <p className="text-sm italic leading-relaxed" style={{ color: theme.text }}>"{transcript}"</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs font-mono">
            <span style={{ color: theme.gold }}>{metrics?.wordCount ?? 0} words</span>
            <span style={{ color: theme.cyan }}>{metrics?.wpm ?? 0} WPM</span>
            <span style={{ color: (metrics?.fillers ?? 0) > 2 ? theme.coral : theme.textDim }}>{metrics?.fillers ?? 0} filler words</span>
            <span style={{ color: theme.textDim }}>{usedVocab.length}/{vocab.length} target words</span>
          </div>
        </div>
      )}
    </div>
  );
}
