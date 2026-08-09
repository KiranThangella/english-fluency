import { useState, useRef, useEffect } from "react";
import { Drama, Mic, MicOff, Send, Edit3 } from "lucide-react";
import { getSpeechRecognition } from "../lib/speech";
import { sendChatMessage, type ChatMessage } from "../lib/api";
import { SCENARIOS } from "../data/content";
import type { Theme } from "../theme";

export default function ChatPractice({ theme, onXp }: { theme: Theme; onXp?: (xp: number) => void }) {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [customDesc, setCustomDesc] = useState("");
  const [customStarted, setCustomStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: SCENARIOS[0].opener }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supported = !!getSpeechRecognition();

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  const pickScenario = (sc: typeof SCENARIOS[number]) => {
    setScenario(sc);
    setCustomStarted(false);
    setCustomDesc("");
    if (sc.id !== "custom") setMessages([{ role: "assistant", content: sc.opener }]);
  };

  const startCustom = () => {
    if (!customDesc.trim()) return;
    setCustomStarted(true);
    setMessages([{ role: "assistant", content: "Got it — I'll play that role. Go ahead and start whenever you're ready." }]);
  };

  const startMic = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    setListening(true);
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onresult = (e: any) => setInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try { rec.start(); } catch { setListening(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput(""); setSending(true);
    try {
      const { reply, xp } = await sendChatMessage(scenario.id, nextMessages.slice(-10), scenario.id === "custom" ? customDesc : undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      onXp?.(xp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hmm, I couldn't respond just now. Try again?";
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    } finally { setSending(false); }
  };

  const showCustomSetup = scenario.id === "custom" && !customStarted;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            onClick={() => pickScenario(sc)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2"
            style={scenario.id === sc.id ? { backgroundColor: theme.gold, color: theme.onGold } : { backgroundColor: theme.chipBg, color: theme.textDim, border: `1px solid ${theme.chipBorder}` }}
          >
            {sc.id === "custom" ? <Edit3 size={12} /> : <Drama size={12} />} {sc.label}
          </button>
        ))}
      </div>

      {showCustomSetup ? (
        <div className="rounded-2xl border backdrop-blur-xl p-4" style={{ borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.gold }}><Edit3 size={14} /> Describe your scenario</div>
          <div className="flex items-center gap-2">
            <input
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startCustom()}
              placeholder="e.g. a landlord discussing a rent increase"
              className="flex-1 rounded-full px-3.5 py-2 text-sm border focus:outline-none"
              style={{ backgroundColor: theme.input, borderColor: theme.panelBorder, color: theme.text }}
            />
            <button onClick={startCustom} disabled={!customDesc.trim()} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold disabled:opacity-30 transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.gold, color: theme.onGold }}>Start</button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border backdrop-blur-xl flex flex-col" style={{ height: 460, borderColor: theme.panelBorder, backgroundColor: theme.panel }}>
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: theme.panelBorder }}>
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: theme.cyan }} />
              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: theme.cyan }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: theme.text }}>{scenario.id === "custom" ? customDesc : scenario.label}</span>
            <span className="text-xs ml-auto font-mono" style={{ color: theme.textDim }}>live · unscripted</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user" ? { backgroundColor: theme.gold, color: theme.onGold, borderBottomRightRadius: 4 } : { backgroundColor: theme.chipBg, color: theme.text, border: `1px solid ${theme.chipBorder}`, borderBottomLeftRadius: 4 }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="px-3.5 py-2.5 rounded-2xl text-sm font-mono" style={{ backgroundColor: theme.chipBg, color: theme.cyan, borderBottomLeftRadius: 4 }}>●●●</div></div>}
          </div>
          <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: theme.panelBorder }}>
            {supported && (
              <button onClick={startMic} disabled={listening} className="shrink-0 p-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2" style={listening ? { backgroundColor: theme.coral, color: theme.onCoral } : { backgroundColor: theme.chipBg, color: theme.cyan }} aria-label="Speak">
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={listening ? "Listening…" : "Type or speak your reply…"}
              className="flex-1 rounded-full px-4 py-2.5 text-sm border focus:outline-none"
              style={{ backgroundColor: theme.input, borderColor: theme.panelBorder, color: theme.text }}
            />
            <button onClick={send} disabled={!input.trim() || sending} className="shrink-0 p-2.5 rounded-full disabled:opacity-30 transition-colors focus:outline-none focus-visible:ring-2" style={{ backgroundColor: theme.cyan, color: theme.onCyan }} aria-label="Send">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
