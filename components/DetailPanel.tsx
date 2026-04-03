"use client";

import type { Conflict } from "../lib/types";
import { daysSince, fmt } from "../lib/cost";
import StatCard from "./StatCard";

const SKULL = "✕"; // neutral marker — avoids emoji rendering inconsistency

interface Props {
  conflict: Conflict;
  cost: number;
  now: Date;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "#e74c3c",
  CEASEFIRE: "#f39c12",
  FROZEN:    "#3498db",
  ENDED:     "#4a5568",
};

export default function DetailPanel({ conflict: c, cost }: Props) {
  const isOver = !!c.endDate;
  const totalDays = daysSince(c.startDate);

  return (
    <div className="fadeUp">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Days"     value={totalDays.toLocaleString()}         color={c.color} />
        <StatCard label={isOver ? "Final Cost Est." : "Daily Rate"} value={isOver ? fmt(cost) : fmt(c.ratePerDay, 0) + "/day"} color={c.color} />
        <StatCard label="Status"         value={c.status}                            color={STATUS_COLORS[c.status] ?? c.color} />
        <StatCard label={isOver ? "Conflict Ended" : "Per Second"} value={isOver ? (c.endDate ?? "—") : fmt(c.ratePerDay / 86_400, 2)} color={c.color} />
      </div>

      {[
        { label: "Parties",       value: c.parties  },
        { label: "Model Summary", value: c.summary  },
        { label: "Sources",       value: c.sources  },
      ].map((s) => (
        <div key={s.label} style={{
          background: "#0c0f14", border: "1px solid #1a2030",
          borderLeft: `3px solid ${c.color}`, padding: "14px 18px", marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: c.color, marginBottom: 7 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 13, color: "#8a9ab0", lineHeight: 1.75 }}>{s.value}</div>
        </div>
      ))}

      <div style={{ background: "#0c0f14", border: "1px solid #1a2030", borderLeft: `3px solid ${c.color}`, padding: "14px 18px", marginBottom: c.comparables?.length ? 10 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: c.color, marginBottom: 10 }}>
          Cost Estimates
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {(isOver ? [
            { label: "Total Est. Cost",  value: fmt(cost) },
            { label: "Rate (at peak)",   value: fmt(c.ratePerDay, 0) + "/day" },
            { label: "Per Day (avg)",    value: fmt(cost / Math.max(totalDays, 1)) },
            { label: "Duration",         value: `${totalDays.toLocaleString()} days` },
          ] : [
            { label: "Total Est. Cost",  value: fmt(cost) },
            { label: "Last 30 days",     value: fmt(c.ratePerDay * 30) },
            { label: "Last 7 days",      value: fmt(c.ratePerDay * 7) },
            { label: "Last 24 hours",    value: fmt(c.ratePerDay) },
          ]).map((r) => (
            <div key={r.label}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 17, color: "#f0f4f8" }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {c.comparables && c.comparables.length > 0 && (
        <div style={{ background: "#0c0f14", border: "1px solid #1a2030", borderLeft: `3px solid ${c.color}`, padding: "14px 18px", marginBottom: c.casualties ? 10 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: c.color, marginBottom: 12 }}>
            Compared To
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.comparables.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ color: c.color, fontSize: 16, lineHeight: 1.2, flexShrink: 0, marginTop: 1, opacity: 0.7 }}>≈</div>
                <div style={{ fontSize: 13, color: "#8a9ab0", lineHeight: 1.75 }}>{line}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {c.casualties && (
        <div style={{ background: "#0c0f14", border: "1px solid #1a2030", borderLeft: `3px solid #4a5568`, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#6a7a8a" }}>
              Human Cost — Casualties
            </div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#2d3a4a" }}>
              est. as of {c.casualties.asOf}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 12 }}>
            {c.casualties.entries.map((entry, i) => (
              <div key={i} style={{ background: "#080b10", border: "1px solid #1a2030", padding: "10px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: 1, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 5, lineHeight: 1.4 }}>{entry.label}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 15, color: "#8a9ab0" }}>{entry.count}</div>
              </div>
            ))}
          </div>

          {c.casualties.note && (
            <div style={{ fontSize: 11, color: "#2d3a4a", lineHeight: 1.7, marginBottom: 8 }}>
              ⚠ {c.casualties.note}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#1e2a38", lineHeight: 1.6 }}>
            Sources: {c.casualties.source}
          </div>
        </div>
      )}
    </div>
  );
}
