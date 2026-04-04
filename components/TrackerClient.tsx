"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Conflict } from "../lib/types";
import { calcCost, daysSince, fmt, fmtLive } from "../lib/cost";
import ConflictBar from "./ConflictBar";
import DetailPanel from "./DetailPanel";
import StatCard from "./StatCard";
import EmailCapture from "./EmailCapture";

interface Props { conflicts: Conflict[]; }

const SITE = "https://conflictcost.org";

const REGIONS = ["All", "Middle East", "Europe", "Africa", "Asia"] as const;
type Region = typeof REGIONS[number];

const SORT_OPTIONS = [
  { value: "cost",     label: "Total Cost" },
  { value: "rate",     label: "Daily Rate" },
  { value: "duration", label: "Duration"   },
  { value: "start",    label: "Start Date" },
] as const;
type SortBy = typeof SORT_OPTIONS[number]["value"];

export default function TrackerClient({ conflicts }: Props) {
  const [now, setNow]             = useState(() => new Date());
  const [selected, setSelected]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<"active" | "all">("active");
  const [region, setRegion]       = useState<Region>("All");
  const [sortBy, setSortBy]       = useState<SortBy>("cost");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 300);
    return () => clearInterval(id);
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const conflictCosts = conflicts.map((c) => ({
    ...c,
    cost: calcCost(c, now),
  }));

  const activeOnly = conflictCosts.filter((c) => c.status === "ACTIVE");

  // Apply status filter then region filter
  const statusFiltered = filter === "active" ? activeOnly : conflictCosts;
  const displayed = region === "All"
    ? statusFiltered
    : statusFiltered.filter((c) => c.region === region);

  // Sort the displayed list
  const sorted = [...displayed].sort((a, b) => {
    if (sortBy === "cost")     return b.cost - a.cost;
    if (sortBy === "rate")     return b.ratePerDay - a.ratePerDay;
    if (sortBy === "duration") return daysSince(a.startDate) > daysSince(b.startDate) ? -1 : 1;
    if (sortBy === "start")    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return 0;
  });

  const globalTotal = displayed.reduce((s, c) => s + c.cost, 0);
  const globalRate  = displayed.filter(c => c.status === "ACTIVE").reduce((s, c) => s + c.ratePerDay, 0);

  // Earliest active conflict in the current view (for "Since" label)
  const displayedActive = displayed.filter(c => c.status === "ACTIVE");
  const earliestStart   = displayedActive.length > 0
    ? displayedActive.reduce((min, c) => c.startDate < min ? c.startDate : min, displayedActive[0].startDate)
    : null;

  // Last updated — max casualties.asOf across ALL conflicts (format: "YYYY-MM")
  const lastUpdatedRaw = conflicts.reduce((max, c) => {
    const d = (c as any).casualties?.asOf ?? "";
    return d > max ? d : max;
  }, "");
  const lastUpdated = lastUpdatedRaw
    ? new Date(lastUpdatedRaw + "-02T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  const active      = conflictCosts.find((c) => c.id === selected) ?? null;
  const displayCost = active ? active.cost : globalTotal;
  const displayRate = active ? (active.status === "ACTIVE" ? active.ratePerDay : 0) : globalRate;
  const displayColor = active ? active.color : "#e74c3c";
  const liveDisplay = fmtLive(displayCost);
  const maxCost     = Math.max(...displayed.map((c) => c.cost), 1);

  // Region counts for badge labels
  const regionCounts = (r: Region) => {
    const base = filter === "active" ? activeOnly : conflictCosts;
    return r === "All" ? base.length : base.filter(c => c.region === r).length;
  };

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
          <div style={{ display: "flex", gap: 4 }}>
            {(["active", "all"] as const).map((f) => (
              <button key={f} onClick={() => { setFilter(f); setSelected(null); }}
                style={{ background: filter === f ? "#1e2a38" : "transparent", border: `1px solid ${filter === f ? "#2a3a50" : "#1a2030"}`, color: filter === f ? "#c8d4e0" : "#3d4a5a", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "5px 12px", textTransform: "uppercase", cursor: "pointer" }}>
                {f === "active" ? "Active Only" : "All Conflicts"}
              </button>
            ))}
          </div>
          <Link href="/methodology" style={{ background: "transparent", border: "1px solid #1a2030", color: "#3d4a5a", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "5px 12px", textTransform: "uppercase", textDecoration: "none" }}>
            Methodology
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, letterSpacing: 2, color: "#e74c3c", fontFamily: "'Share Tech Mono', monospace" }}>
            <div className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c" }} />LIVE
          </div>
        </div>
      </header>

      {/* REGION FILTER */}
      <div style={{ background: "#080b10", borderBottom: "1px solid #1a2030", padding: "8px 20px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, letterSpacing: 3, color: "#2d3a4a", textTransform: "uppercase", marginRight: 6, flexShrink: 0 }}>Region</span>
        {REGIONS.map((r) => {
          const count = regionCounts(r);
          const isActive = region === r;
          return (
            <button key={r} onClick={() => { setRegion(r); setSelected(null); }}
              style={{
                background: isActive ? "#1a2535" : "transparent",
                border: `1px solid ${isActive ? "#2a3a50" : "#1a2030"}`,
                color: isActive ? "#c8d4e0" : "#3d4a5a",
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                padding: "4px 10px", textTransform: "uppercase", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
              }}>
              {r}
              {count > 0 && (
                <span style={{
                  background: isActive ? "#2a3a50" : "#131820",
                  color: isActive ? "#7a9ab0" : "#2d3a4a",
                  fontSize: 9, fontWeight: 800,
                  padding: "1px 5px", borderRadius: 8,
                  fontFamily: "'Share Tech Mono', monospace",
                }}>{count}</span>
              )}
            </button>
          );
        })}
        {region !== "All" && (
          <button onClick={() => { setRegion("All"); setSelected(null); }}
            style={{ background: "transparent", border: "none", color: "#4a5568", fontSize: 10, cursor: "pointer", letterSpacing: 1, padding: "4px 6px", marginLeft: 2 }}>
            ✕ clear
          </button>
        )}
      </div>

      {/* CONFLICT SELECTOR */}
      <div style={{ position: "relative", background: "#0a0c10", borderBottom: "1px solid #1a2030" }}>
        <nav style={{
          padding: "10px 20px",
          display: "flex",
          gap: 6,
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}>
          <SelectorBtn active={selected === null} color="#e74c3c" onClick={() => setSelected(null)}>
            🌐 {region === "All" ? (filter === "active" ? "All Active" : "All Conflicts") : region}
          </SelectorBtn>
          {displayed.map((c) => (
            <SelectorBtn key={c.id} active={selected === c.id} color={c.color} onClick={() => setSelected(c.id)}>
              {c.flag} {c.name}
            </SelectorBtn>
          ))}
        </nav>
        {/* Right fade to hint at scrollable content */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 48,
          background: "linear-gradient(to right, transparent, #0a0c10)",
          pointerEvents: "none",
        }} />
      </div>

      {/* COUNTER */}
      <section style={{ textAlign: "center", padding: "40px 20px 28px", borderBottom: "1px solid #1a2030" }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", marginBottom: 10, textTransform: "uppercase" }}>
          {active
            ? `${active.name} · Since ${new Date(active.startDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${active.endDate ? ` → ${active.endDate}` : ""}`
            : `Combined Estimate · ${region !== "All" ? region + " · " : ""}${filter === "active" ? `${displayed.length} Active` : `${displayed.length} Conflicts`}${earliestStart ? ` · Since ${new Date(earliestStart + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}`}
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
        {active && (
          <div style={{ marginTop: 18 }}>
            <button onClick={() => setEmbedOpen(true)}
              style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "6px 14px", textTransform: "uppercase", cursor: "pointer" }}>
              &lt;/&gt; Embed This Counter
            </button>
          </div>
        )}
      </section>

      {/* EMBED MODAL */}
      {embedOpen && active && (() => {
        const iframeUrl = `${SITE}/embed/${active.id}`;
        const snippet = `<iframe\n  src="${iframeUrl}"\n  width="480"\n  height="140"\n  frameborder="0"\n  style="border:none;overflow:hidden"\n  allowtransparency="true"\n  title="${active.name} cost tracker"\n></iframe>`;
        return (
          <div onClick={() => setEmbedOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#0e1218", border: "1px solid #1e2a38", maxWidth: 560, width: "100%", padding: "28px 28px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 4 }}>Embed Widget</div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#e8edf5" }}>{active.flag} {active.name}</div>
                </div>
                <button onClick={() => setEmbedOpen(false)} style={{ background: "transparent", border: "none", color: "#3d4a5a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
              <div style={{ background: "#070a0d", border: "1px solid #1a2030", marginBottom: 20, overflow: "hidden", height: 140 }}>
                <iframe src={`/embed/${active.id}`} width="100%" height="140" style={{ border: "none", display: "block" }} title={`${active.name} embed preview`} />
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>HTML Snippet</div>
              <pre style={{ background: "#070a0d", border: "1px solid #1a2030", padding: "14px 16px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#7a9ab0", overflowX: "auto", whiteSpace: "pre", marginBottom: 14, lineHeight: 1.7 }}>{snippet}</pre>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleCopy(snippet)}
                  style={{ flex: 1, background: copied ? "#1a3a2a" : "#1e2a38", border: `1px solid ${copied ? "#2a5a3a" : "#2a3a50"}`, color: copied ? "#4aaa6a" : "#c8d4e0", fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "9px 16px", textTransform: "uppercase", cursor: "pointer" }}>
                  {copied ? "✓ Copied!" : "Copy Code"}
                </button>
                <a href={`/embed/${active.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "9px 16px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center" }}>
                  Preview ↗
                </a>
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: "#2d3a4a", lineHeight: 1.7 }}>
                Recommended size: 480 × 140 px. The widget is responsive — it scales to fill its container. No API key required.
              </div>
            </div>
          </div>
        );
      })()}

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 60px" }}>
        {active ? (
          <DetailPanel conflict={active} cost={active.cost} now={now} />
        ) : (
          <div className="fadeUp">

            {/* SORT CONTROLS */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase" }}>
                {displayed.length} conflict{displayed.length !== 1 ? "s" : ""}{region !== "All" ? ` · ${region}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, letterSpacing: 2, color: "#2d3a4a", textTransform: "uppercase" }}>Sort</span>
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button key={value} onClick={() => setSortBy(value as SortBy)}
                    style={{
                      background: sortBy === value ? "#1a2535" : "transparent",
                      border: `1px solid ${sortBy === value ? "#2a3a50" : "#1a2030"}`,
                      color: sortBy === value ? "#c8d4e0" : "#3d4a5a",
                      fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      padding: "4px 10px", textTransform: "uppercase", cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {displayed.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, color: "#3d4a5a" }}>
                No conflicts match this filter.
              </div>
            ) : (
              sorted.map((c) => (
                <ConflictBar key={c.id} conflict={c} cost={c.cost} globalTotal={globalTotal} maxCost={maxCost} onClick={() => setSelected(c.id)} />
              ))
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginTop: 22 }}>
              <StatCard label="Shown"              value={String(displayed.length)}          color="#4a5568" />
              <StatCard label="Active Conflicts"   value={String(activeOnly.length)}         color="#e74c3c" />
              <StatCard label="Combined Daily Burn" value={fmt(globalRate, 1)}               color="#e74c3c" />
              <StatCard label="Per Second (shown)" value={fmt(globalRate / 86_400, 0)}      color="#e74c3c" />
            </div>

            {lastUpdated && (
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#2d3a4a", textTransform: "uppercase", marginTop: 12 }}>
                Data last updated {lastUpdated} · SIPRI · ACLED · UCDP · OHCHR
              </div>
            )}

            <EmailCapture />
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
    <button onClick={onClick} style={{ background: active ? color : "transparent", border: `1px solid ${active ? color : "#1e2530"}`, color: active ? "#fff" : "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "6px 13px", textTransform: "uppercase", transition: "all 0.15s", whiteSpace: "nowrap", cursor: "pointer" }}>
      {children}
    </button>
  );
}
