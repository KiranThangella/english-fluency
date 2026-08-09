export interface Theme {
  mode: "dark" | "light";
  bg: string;
  text: string;
  textDim: string;
  panel: string;
  panelBorder: string;
  panelHover: string;
  input: string;
  gold: string;
  onGold: string;
  cyan: string;
  onCyan: string;
  coral: string;
  onCoral: string;
  chipBg: string;
  chipBorder: string;
  nebula: [string, string, string];
  starColor: string;
  gridLine: string;
}

export const DARK: Theme = {
  mode: "dark", bg: "#05070C", text: "#EDF1FA", textDim: "#8B96B8",
  panel: "rgba(255,255,255,0.035)", panelBorder: "rgba(255,255,255,0.08)", panelHover: "rgba(94,234,212,0.3)",
  input: "rgba(0,0,0,0.28)", gold: "#D4A24C", onGold: "#0A0F1E", cyan: "#5EEAD4", onCyan: "#0A0F1E",
  coral: "#E85D42", onCoral: "#FFFFFF", chipBg: "rgba(255,255,255,0.04)", chipBorder: "rgba(255,255,255,0.08)",
  nebula: ["#7C3AED", "#22D3D0", "#D4A24C"], starColor: "255,255,255", gridLine: "rgba(94,234,212,0.8)",
};

export const LIGHT: Theme = {
  mode: "light", bg: "#F5F3FA", text: "#1C2033", textDim: "#5C6284",
  panel: "rgba(255,255,255,0.6)", panelBorder: "rgba(28,32,51,0.10)", panelHover: "rgba(13,138,130,0.35)",
  input: "rgba(255,255,255,0.85)", gold: "#A8752A", onGold: "#FFFFFF", cyan: "#0B8A82", onCyan: "#FFFFFF",
  coral: "#C8431F", onCoral: "#FFFFFF", chipBg: "rgba(28,32,51,0.03)", chipBorder: "rgba(28,32,51,0.10)",
  nebula: ["#C9B6F5", "#A8E8D8", "#F5C9A0"], starColor: "28,32,51", gridLine: "rgba(13,138,130,0.5)",
};
