"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Conflict } from "../../../lib/types";
import { calcCost, fmt } from "../../../lib/cost";
import conflictsData from "../../../conflicts.config.json";

const conflicts = conflictsData as Conflict[];

function fmtLiveCombined(n: number): { val: string; unit: string } {
  if (n >= 1e12) return { val: (n / 1e12).toFixed(3), unit: "T" };
  if (n >= 1e9)  return { val: (n / 1e9).toFixed(3),  unit: "B" };
  if (n >= 1e6)  return { val: (n / 1e6).toFixed(3),  unit: "M" };
  return { val: Math.round(n).toLocaleString(), unit: "" };
}

export default function GlobalEmbedPage() {
  const searchParams = useSearchParams();
  const regionParam  = searchParams.get("region"); // e.g. "Europe", null = worldwide
  const [now, setNow] = useState(() => new Date());

  const active = conflicts.filter(c =>
    c.status === "ACTIVE" && (!regionParam || c.region === regionParam)
  );

  useEffect(() => {
    if (active.length === 0) return;
    const timer = setInterval(() => setNow(new Date()), 300);
    return () => clearInterval(timer);
  }, [active.length]);

  const totCost = active.reduce((s, c) => s + calcCost(c, now), 0);
  const totRate = active.reduce((s, c) => s + c.ratePerDay, 0);
  const live    = fmtLiveCombined(totCost);
  const n       = active.length;
  const label   = regionParam ? regionParam : "Worldwide";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; background: #0c0f14; overflow: hidden; }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes flicker {
          0%, 94%, 100% { opacity: 1; }
          95% { opacity: 0.92; }
          96% { opacity: 1; }
          97% { opacity: 0.95; }
        }
        .blink { animation: blink 1.2s ease-in-out infinite; }
        .flicker { animation: flicker 8s ease-in-out infinite; }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#0c0f14",
        border: "1px solid #e74c3c33",
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: "14px 18px 12px",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Subtle top glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, #e74c3c66, transparent)",
          pointerEvents: "none",
        }} />

        {/* TOP ROW: label + live badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 22 }}>🌐</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#e8edf5", lineHeight: 1.15 }}>
                Active Wars — {label}
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginTop: 2 }}>
                {n} active conflict{n !== 1 ? "s" : ""} · direct military expenditure
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {n > 0 && (
              <div className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, letterSpacing: 2, color: "#e74c3c", fontFamily: "'Share Tech Mono', monospace" }}>
              {n > 0 ? "LIVE" : "NO ACTIVE"}
            </span>
          </div>
        </div>

        {/* COUNTER */}
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          <div className="flicker" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "clamp(26px, 5vw, 44px)", color: "#f0f4f8", lineHeight: 1, textShadow: "0 0 40px #e74c3c44", letterSpacing: -1 }}>
            <span style={{ color: "#e74c3c" }}>$</span>
            {live.val}
            {live.unit && (
              <span style={{ color: "#e74c3c", fontSize: "0.45em", verticalAlign: "middle", marginLeft: 5 }}>
                {live.unit}
              </span>
            )}
          </div>
          {n > 0 ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, marginTop: 8 }}>
              {[
                { label: "/day", val: fmt(totRate, 0),          hero: false },
                { label: "/hr",  val: fmt(totRate / 24, 1),     hero: true  },
                { label: "/sec", val: fmt(totRate / 86_400, 0), hero: false },
              ].map(r => (
                <div key={r.label} style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: r.hero ? 19 : 13,
                    color: r.hero ? "#f39c12" : "#7a6030",
                    textShadow: r.hero ? "0 0 14px #f39c1255" : "none",
                    lineHeight: 1,
                  }}>{r.val}</div>
                  <div style={{
                    fontSize: 9,
                    letterSpacing: 2,
                    color: r.hero ? "#7a6030" : "#3d4a5a",
                    textTransform: "uppercase",
                    marginTop: r.hero ? 4 : 2,
                  }}>{r.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", marginTop: 6, fontFamily: "'Share Tech Mono', monospace" }}>
              NO ACTIVE CONFLICTS IN THIS REGION
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href={`https://conflictcost.org${regionParam ? `?region=${encodeURIComponent(regionParam)}` : ""}`}
             target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 10, letterSpacing: 2, color: "#2d3a4a", textDecoration: "none", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>
            conflictcost.org
          </a>
          <div style={{ fontSize: 10, letterSpacing: 1, color: "#2d3a4a" }}>
            combined estimate · all parties
          </div>
        </div>

      </div>
    </>
  );
}
