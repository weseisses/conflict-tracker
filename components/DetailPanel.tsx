"use client";

import type { Conflict } from "../lib/types";
import { daysSince, fmt } from "../lib/cost";
import StatCard from "./StatCard";

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

      <div style={{ background: "#0c0f14", border: "1px solid #1a2030", borderLeft: `3px solid ${c.color}`, padding: "14px 18px" }}>
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
    </div>
  );
}
