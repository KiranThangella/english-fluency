import { useMemo } from "react";
import type { Theme } from "../theme";

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export default function NebulaBackground({ theme }: { theme: Theme }) {
  const isDark = theme.mode === "dark";
  const stars = useMemo(() => {
    const rnd = seededRandom(17);
    return Array.from({ length: 55 }, () => ({
      x: rnd() * 100, y: rnd() * 100, r: rnd() * 1.4 + 0.4, delay: rnd() * 5, dur: 2.5 + rnd() * 3,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-500" style={{ backgroundColor: theme.bg }}>
      {theme.nebula.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480 + i * 60, height: 380 + i * 40,
            background: `radial-gradient(circle, ${c}, transparent 70%)`,
            opacity: isDark ? 0.22 : 0.35,
            top: `${[-8, 30, 55][i]}%`, left: `${[15, 65, 5][i]}%`,
            animation: `drift${i} ${18 + i * 6}s ease-in-out infinite`,
          }}
        />
      ))}
      {isDark && stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2,
            background: `rgba(${theme.starColor},0.9)`,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          opacity: isDark ? 0.035 : 0.03,
        }}
      />
    </div>
  );
}
