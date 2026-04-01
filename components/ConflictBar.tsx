"use client";

import type { Conflict } from "../lib/types";
import { daysSince, fmt } from "../lib/cost";

interface Props {
  conflict: Conflict;
  cost: number;
  globalTotal: number;
  maxCost: number;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "#e74c3c",
  CEASEFIRE: "#f39c12",
  FROZEN:    "#3498db",
  ENDED:     "#4a5568",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "2px 6px",
      background: STATUS_COLORS[status] ?? "#4a5568",
      color: status === "ENDED" ? "#9aa8b8" : "#fff",
      textTransform: "uppercase", verticalAlign: "middle",
    }}>
      {status}
    </span>
  );
}

export default function ConflictBar({ conflict: c, cost, globalTotal, maxCost, onClick }: Props) {
  const pct    = (cost / globalTotal) * 100;
  const barPct = (cost / maxCost) * 100;
  const isOver = !!c.endDate;
  const daysLabel = isOver
    ? `${daysSince(c.startDate).toLocaleString()} days total`
    : `Day ${daysSince(c.startDate).toLocaleString()}`;

  return (
    <div
      onClick={onClick}
      style={{
        background: "#0c0f14",
        border: "1px solid #1a2030",
        marginBottom: 8,
        padding: "13px 16px",
        cursor: "pointer",
        transition: "border-color 0.15s",
        opacity: isOver ? 0.8 : 1,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = c.color)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#1a2030")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{c.flag}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8edf5", letterSpacing: 1 }}>{c.name}</div>
              <StatusBadge status={c.status} />
            </div>
            <div style={{ fontSize: 10, color: "#3d4a5a", marginTop: 2 }}>
              {c.region} · {daysLabel} · {c.parties}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 17, color: isOver ? "#6a7a8a" : c.color }}>
            {fmt(cost)}
          </div>
          <div style={{ fontSize: 10, color: "#3d4a5a" }}>
            {pct.toFixed(1)}% of total · {isOver ? "final" : fmt(c.ratePerDay, 0) + "/day"}
          </div>
        </div>
      </div>
      <div style={{ height: 3, background: "#1a2030", borderRadius: 2 }}>
        <div style={{ height: "100%", width: barPct + "%", background: isOver ? "#2a3a4a" : c.color, borderRadius: 2 }} />
      </div>
    </div>
  );
}
