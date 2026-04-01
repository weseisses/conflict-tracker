"use client";

import { useState, useEffect } from "react";
import type { Conflict } from "../lib/types";
import { calcCost, daysSince, fmt, fmtLive } from "../lib/cost";
import ConflictBar from "./ConflictBar";
import DetailPanel from "./DetailPanel";
import StatCard from "./StatCard";

interface Props { conflicts: Conflict[]; }

export default function TrackerClient({ conflicts }: Props) {
  const [now, setNow]         = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter]   = useState<"active" | "all">("active");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 300);
    return () => clearInterval(id);
  }, []);

  const conflictCosts = conflicts.map((c) => ({
    ...c,
    cost: calcCost(c, now),
  }));

  const activeOnly = conflictCosts.filter((c) => c.status === "ACTIVE");
  const displayed  = filter === "active" ? activeOnly : conflictCosts;

  const globalTotal = displayed.reduce((s, c) => s + c.cost, 0);
  const globalRate  = displayed.filter(c => c.status === "ACTIVE").reduce((s, c) => s + c.ratePerDay, 0);

  const active      = conflictCosts.find((c) => c.id === selected) ?? null;
  const displayCost = active ? active.cost : globalTotal;
  const displayRate = active ? (active.status === "ACTIVE" ? active.ratePerDay : 0) : globalRate;
  const displayColor = active ? active.color : "#e74c3c";
  const liveDisplay = fmtLive(displayCost);
  const maxCost     = Math.max(...displayed.map((c) => c.cost), 1);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <header style={{ background: "#0c0f14", borderBottom: "1px solid #1a2030", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#e74c3c", color: "#fff", fontWeight: 800, fontSize: 10, letterSpacing: 2, padding: "4px 10px" }}>GLOBAL</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#e8edf5" }}>CONFLICT COST TRACKER</div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase" }}>
              Live estimates · {activeOnly.length} active · {conflicts.length} total tracked
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Active / All toggle */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["active", "all"] as const).map((f) => (
              <button key={f} onClick={() => { setFilter(f); setSelected(null); }}
                style={{ background: filter === f ? "#1e2a38" : "transparent", border: `1px solid ${filter === f ? "#2a3a50" : "#1a2030"}`, color: filter === f ? "#c8d4e0" : "#3d4a5a", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "5px 12px", textTransform: "uppercase" }}>
                {f === "active" ? "Active Only" : "All Conflicts"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, letterSpacing: 2, color: "#e74c3c", fontFamily: "'Share Tech Mono', monospace" }}>
            <div className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c" }} />LIVE
          </div>
        </div>
      </header>

      {/* CONFLICT SELECTOR */}
      <nav style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", background: "#0a0c10", borderBottom: "1px solid #1a2030" }}>
        <SelectorBtn active={selected === null} color="#e74c3c" onClick={() => setSelected(null)}>
          🌐 {filter === "active" ? "All Active" : "All Conflicts"}
        </SelectorBtn>
        {displayed.map((c) => (
          <SelectorBtn key={c.id} active={selected === c.id} color={c.color} onClick={() => setSelected(c.id)}>
            {c.flag} {c.name}
          </SelectorBtn>
        ))}
      </nav>

      {/* COUNTER */}
      <section style={{ textAlign: "center", padding: "40px 20px 28px", borderBottom: "1px solid #1a2030" }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", marginBottom: 10, textTransform: "uppercase" }}>
          {active
            ? `${active.name} · Since ${new Date(active.startDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${active.endDate ? ` → ${active.endDate}` : ""}`
            : `Combined Estimate · ${filter === "active" ? `${activeOnly.length} Active` : `All ${conflicts.length}`} Conflicts`}
        </div>
        <div className="flicker" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "clamp(36px, 7vw, 80px)", color: "#f0f4f8", lineHeight: 1, textShadow: `0 0 60px ${displayColor}44` }}>
          <span style={{ color: displayColor }}>$</span>{liveDisplay.val}
          <span style={{ color: displayColor, fontSize: "0.44em", verticalAlign: "middle", marginLeft: 6 }}>{liveDisplay.unit}</span>
        </div>
        {displayRate > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "/ sec",  val: fmt(displayRate / 86_400, 0) },
              { label: "/ min",  val: fmt(displayRate / 1_440, 1) },
              { label: "/ hour", val: fmt(displayRate / 24, 1) },
              { label: "/ day",  val: fmt(displayRate, 1) },
            ].map((r) => (
              <div key={r.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 17, color: "#f39c12" }}>{r.val}</div>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginTop: 2 }}>{r.label}</div>
              </div>
            ))}
          </div>
        )}
        {active && active.status !== "ACTIVE" && (
          <div style={{ marginTop: 14, fontSize: 12, color: "#4a5568", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2 }}>
            COUNTER FROZEN AT END DATE — FINAL ESTIMATE
          </div>
        )}
      </section>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 60px" }}>
        {active ? (
          <DetailPanel conflict={active} cost={active.cost} now={now} />
        ) : (
          <div className="fadeUp">
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 14 }}>
              Cost by Conflict — sorted by total estimated spend
            </div>
            {[...displayed].sort((a, b) => b.cost - a.cost).map((c) => (
              <ConflictBar key={c.id} conflict={c} cost={c.cost} globalTotal={globalTotal} maxCost={maxCost} onClick={() => setSelected(c.id)} />
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginTop: 22 }}>
              <StatCard label="Active Conflicts"    value={String(activeOnly.length)}     color="#e74c3c" />
              <StatCard label="Total Tracked"       value={String(conflicts.length)}       color="#4a5568" />
              <StatCard label="Combined Daily Burn" value={fmt(globalRate, 1)}             color="#e74c3c" />
              <StatCard label="Per Second (active)" value={fmt(globalRate / 86_400, 0)}   color="#e74c3c" />
            </div>
          </div>
        )}

        <div style={{ marginTop: 36, fontSize: 11, color: "#2d3a4a", lineHeight: 1.9, borderTop: "1px solid #1a2030", paddingTop: 18 }}>
          <strong style={{ color: "#3d4a5a" }}>Methodology:</strong>{" "}
          All figures are open-source estimates of direct military expenditure across all major parties,
          including foreign military aid in delivery. Historical conflicts are frozen at their end date.
          Excludes: long-term veteran care, reconstruction costs, economic spillover, and classified programs.{" "}
          <strong style={{ color: "#3d4a5a" }}>Sources:</strong>{" "}
          SIPRI Military Expenditure Database; CSIS; Brown University Costs of War; CFR; GAO;
          Bank of Israel; Pentagon Congressional briefings; ACLED; Wilson Center.
        </div>
      </main>
    </div>
  );
}

function SelectorBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void; }) {
  return (
    <button onClick={onClick} style={{ background: active ? color : "transparent", border: `1px solid ${active ? color : "#1e2530"}`, color: active ? "#fff" : "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "6px 13px", textTransform: "uppercase", transition: "all 0.15s", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}
