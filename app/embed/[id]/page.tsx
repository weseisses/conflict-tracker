"use client";

import { useState, useEffect, use } from "react";
import type { Conflict } from "../../../lib/types";
import { calcCost, fmtLive, fmt } from "../../../lib/cost";
import conflictsData from "../../../conflicts.config.json";

const conflicts = conflictsData as Conflict[];

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#e74c3c",
  CEASEFIRE: "#f39c12",
  FROZEN:    "#4a90d9",
  ENDED:     "#4a5568",
};

export default function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const conflict = conflicts.find((c) => c.id === id) ?? null;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!conflict || conflict.status !== "ACTIVE") return;
    const timer = setInterval(() => setNow(new Date()), 300);
    return () => clearInterval(timer);
  }, [conflict]);

  if (!conflict) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0c0f14", color: "#3d4a5a", fontFamily: "'Share Tech Mono', monospace", fontSize: 13 }}>
        CONFLICT NOT FOUND: {id}
      </div>
    );
  }

  const cost = calcCost(conflict, now);
  const live = fmtLive(cost);
  const isOver = !!conflict.endDate;
  const accentColor = conflict.color || "#e74c3c";
  const statusColor = STATUS_COLOR[conflict.status] || "#4a5568";

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
        border: `1px solid ${accentColor}33`,
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: "14px 18px 12px",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Subtle glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`,
          pointerEvents: "none",
        }} />

        {/* TOP ROW: flag + name + status */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 22 }}>{conflict.flag}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#e8edf5", lineHeight: 1.15 }}>
                {conflict.name}
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginTop: 2 }}>
                {conflict.parties}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {conflict.status === "ACTIVE" && (
              <div className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, letterSpacing: 2, color: statusColor, fontFamily: "'Share Tech Mono', monospace" }}>
              {conflict.status}
            </span>
          </div>
        </div>

        {/* COUNTER */}
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          <div className="flicker" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "clamp(26px, 5vw, 44px)", color: "#f0f4f8", lineHeight: 1, textShadow: `0 0 40px ${accentColor}44`, letterSpacing: -1 }}>
            <span style={{ color: accentColor }}>$</span>
            {live.val}
            {live.unit && (
              <span style={{ color: accentColor, fontSize: "0.45em", verticalAlign: "middle", marginLeft: 5 }}>
                {live.unit}
              </span>
            )}
          </div>
          {isOver ? (
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", marginTop: 6, fontFamily: "'Share Tech Mono', monospace" }}>
              FINAL ESTIMATE — ENDED {conflict.endDate}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
              {[
                { label: "/day",  val: fmt(conflict.ratePerDay, 0) },
                { label: "/hr",   val: fmt(conflict.ratePerDay / 24, 1) },
                { label: "/sec",  val: fmt(conflict.ratePerDay / 86_400, 0) },
              ].map(r => (
                <div key={r.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#f39c12" }}>{r.val}</div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase" }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER: branding + since */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="https://conflictcost.org" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, letterSpacing: 2, color: "#2d3a4a", textDecoration: "none", textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>
            conflictcost.org
          </a>
          <div style={{ fontSize: 10, letterSpacing: 1, color: "#2d3a4a" }}>
            since {new Date(conflict.startDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>

      </div>
    </>
  );
}
