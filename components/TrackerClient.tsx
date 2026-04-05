"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [comparableIdx, setComparableIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 300);
    return () => clearInterval(id);
  }, []);

  // Read ?region= and ?filter= URL params on first mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("region");
    if (r && (["Middle East","Europe","Africa","Asia"] as string[]).includes(r)) {
      setRegion(r as Region);
    }
    if (p.get("filter") === "all") setFilter("all");
  }, []);

  // Reset comparable index when switching conflicts
  useEffect(() => { setComparableIdx(0); }, [selected]);

  // Auto-rotate comparables every 6 seconds
  // (use `selected` + `conflicts` — `active` is declared later in the component)
  useEffect(() => {
    if (!selected) return;
    const comps = conflicts.find((c) => c.id === selected)?.comparables;
    if (!comps || comps.length <= 1) return;
    const id = setInterval(() => setComparableIdx((i) => (i + 1) % comps.length), 6000);
    return () => clearInterval(id);
  }, [selected, conflicts]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Drag-to-scroll for conflict nav
  const navRef  = useRef<HTMLElement>(null);
  const drag    = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const onNavMouseDown = (e: React.MouseEvent) => {
    const el = navRef.current; if (!el) return;
    drag.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = "grabbing";
  };
  const onNavMouseMove = (e: React.MouseEvent) => {
    const el = navRef.current; if (!el || !drag.current.active) return;
    const dx = e.pageX - el.offsetLeft - drag.current.startX;
    if (Math.abs(dx) > 4) { drag.current.moved = true; e.preventDefault(); }
    el.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onNavMouseUp = () => {
    drag.current.active = false;
    if (navRef.current) navRef.current.style.cursor = "grab";
  };

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

  // Shareable text for the current view — used in the share modal
  const shareText = (() => {
    const costDisplay = fmtLive(displayCost);
    const costStr = `$${costDisplay.val} ${costDisplay.unit}`;
    const hourlyStr = fmt(displayRate / 24, 1);
    if (active) {
      const startStr = new Date(active.startDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const statusNote = active.status !== "ACTIVE" ? " (final estimate)" : "";
      return `${active.flag} ${active.name} has cost an estimated ${costStr} since ${startStr}${statusNote} — ${hourlyStr}/hr.\n\nTrack it live: ${SITE}`;
    } else {
      const n = displayedActive.length;
      const regionLabel = region !== "All" ? ` in ${region}` : " worldwide";
      return `${n} active conflicts${regionLabel}: estimated ${costStr} and counting — ${hourlyStr}/hr burning right now.\n\nTrack it live: ${SITE}`;
    }
  })();

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
        {/* Left scroll arrow */}
        <button
          onClick={() => navRef.current && (navRef.current.scrollLeft -= 240)}
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 2, width: 32, background: "linear-gradient(to right, #0a0c10 60%, transparent)", border: "none", color: "#3d4a5a", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 6 }}
          aria-label="Scroll left"
        >‹</button>

        <nav
          ref={navRef}
          onMouseDown={onNavMouseDown}
          onMouseMove={onNavMouseMove}
          onMouseUp={onNavMouseUp}
          onMouseLeave={onNavMouseUp}
          style={{
            padding: "10px 36px",
            display: "flex",
            gap: 6,
            flexWrap: "nowrap",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            cursor: "grab",
            userSelect: "none",
          } as React.CSSProperties}
        >
          <SelectorBtn active={selected === null} color="#e74c3c" onClick={() => !drag.current.moved && setSelected(null)}>
            🌐 {region === "All" ? (filter === "active" ? "All Active" : "All Conflicts") : region}
          </SelectorBtn>
          {displayed.map((c) => (
            <SelectorBtn key={c.id} active={selected === c.id} color={c.color} onClick={() => !drag.current.moved && setSelected(c.id)}>
              {c.flag} {c.name}
            </SelectorBtn>
          ))}
        </nav>

        {/* Right scroll arrow */}
        <button
          onClick={() => navRef.current && (navRef.current.scrollLeft += 240)}
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 2, width: 32, background: "linear-gradient(to left, #0a0c10 60%, transparent)", border: "none", color: "#3d4a5a", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}
          aria-label="Scroll right"
        >›</button>
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
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 28, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "/ sec",  val: fmt(displayRate / 86_400, 0), hero: false },
              { label: "/ min",  val: fmt(displayRate / 1_440, 1),  hero: false },
              { label: "/ hour", val: fmt(displayRate / 24, 1),     hero: true  },
              { label: "/ day",  val: fmt(displayRate, 1),          hero: false },
            ].map((r) => (
              <div key={r.label} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: r.hero ? 26 : 17,
                  color: r.hero ? "#f39c12" : "#7a6030",
                  textShadow: r.hero ? "0 0 20px #f39c1255" : "none",
                  lineHeight: 1,
                }}>{r.val}</div>
                <div style={{
                  fontSize: r.hero ? 11 : 10,
                  letterSpacing: 2,
                  color: r.hero ? "#7a6030" : "#2d3a4a",
                  textTransform: "uppercase",
                  marginTop: r.hero ? 5 : 3,
                  fontWeight: r.hero ? 700 : 400,
                }}>{r.label}</div>
              </div>
            ))}
          </div>
        )}
        {active && active.status !== "ACTIVE" && (
          <div style={{ marginTop: 14, fontSize: 12, color: "#4a5568", fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2 }}>
            COUNTER FROZEN AT END DATE — FINAL ESTIMATE
          </div>
        )}

        {/* COMPARABLE CALLOUT — rotates through context anchors */}
        {active?.comparables && active.comparables.length > 0 && (
          <div style={{ maxWidth: 620, margin: "22px auto 0", textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 10 }}>
              ≈ context
            </div>
            <div
              key={comparableIdx}
              className="fadeUp"
              style={{
                fontSize: 14,
                color: "#8a9ab0",
                lineHeight: 1.8,
                minHeight: 46,
                borderLeft: `3px solid ${active.color}`,
                paddingLeft: 16,
                textAlign: "left",
              }}
            >
              {active.comparables[comparableIdx]}
            </div>
            {active.comparables.length > 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginTop: 10 }}>
                {active.comparables.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setComparableIdx(i)}
                    style={{
                      width: i === comparableIdx ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === comparableIdx ? active.color : "#1e2a38",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.3s",
                    }}
                    aria-label={`Context ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShareOpen(true)}
            style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "6px 14px", textTransform: "uppercase", cursor: "pointer" }}>
            ↗ Share This Stat
          </button>
          <button onClick={() => setEmbedOpen(true)}
            style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "6px 14px", textTransform: "uppercase", cursor: "pointer" }}>
            &lt;/&gt; Embed This Counter
          </button>
        </div>
      </section>

      {/* EMBED MODAL */}
      {embedOpen && (() => {
        const embedPath = active
          ? `/embed/${active.id}`
          : region !== "All"
            ? `/embed/global?region=${encodeURIComponent(region)}`
            : "/embed/global";
        const embedLabel = active
          ? `${active.flag} ${active.name}`
          : region !== "All"
            ? `Active Conflicts · ${region}`
            : "All Active Conflicts · Worldwide";
        const iframeUrl = `${SITE}${embedPath}`;
        const snippet = `<iframe\n  src="${iframeUrl}"\n  width="480"\n  height="140"\n  frameborder="0"\n  style="border:none;overflow:hidden"\n  allowtransparency="true"\n  title="${embedLabel} cost tracker"\n></iframe>`;
        return (
          <div onClick={() => setEmbedOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#0e1218", border: "1px solid #1e2a38", maxWidth: 560, width: "100%", padding: "28px 28px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 4 }}>Embed Widget</div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#e8edf5" }}>{embedLabel}</div>
                </div>
                <button onClick={() => setEmbedOpen(false)} style={{ background: "transparent", border: "none", color: "#3d4a5a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
              <div style={{ background: "#070a0d", border: "1px solid #1a2030", marginBottom: 20, overflow: "hidden", height: 140 }}>
                <iframe src={embedPath} width="100%" height="140" style={{ border: "none", display: "block" }} title={`${embedLabel} embed preview`} />
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>HTML Snippet</div>
              <pre style={{ background: "#070a0d", border: "1px solid #1a2030", padding: "14px 16px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#7a9ab0", overflowX: "auto", whiteSpace: "pre", marginBottom: 14, lineHeight: 1.7 }}>{snippet}</pre>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleCopy(snippet)}
                  style={{ flex: 1, background: copied ? "#1a3a2a" : "#1e2a38", border: `1px solid ${copied ? "#2a5a3a" : "#2a3a50"}`, color: copied ? "#4aaa6a" : "#c8d4e0", fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "9px 16px", textTransform: "uppercase", cursor: "pointer" }}>
                  {copied ? "✓ Copied!" : "Copy Code"}
                </button>
                <a href={embedPath} target="_blank" rel="noopener noreferrer"
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

      {/* SHARE MODAL */}
      {shareOpen && (() => {
        const allSuffix  = !active && filter === "all";
        const sharePageUrl = active
          ? `${SITE}/share/${active.id}`
          : region !== "All"
            ? allSuffix
              ? `${SITE}/share/region/${encodeURIComponent(region)}/all`
              : `${SITE}/share/region/${encodeURIComponent(region)}`
            : allSuffix
              ? `${SITE}/share/all`
              : SITE;
        const headline  = shareText.split("\n\n")[0];
        const tweetUrl  = `https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePageUrl)}&text=${encodeURIComponent(headline)}`;
        const linkedIn  = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sharePageUrl)}`;
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`;
        const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(sharePageUrl)}&title=${encodeURIComponent(headline)}`;
        const mailUrl   = `mailto:?subject=${encodeURIComponent("Global Conflict Cost Tracker")}&body=${encodeURIComponent(shareText)}`;
        const ogUrl     = active
          ? `/api/og?id=${active.id}`
          : region !== "All"
            ? `/api/og?region=${encodeURIComponent(region)}${allSuffix ? "&all=1" : ""}`
            : allSuffix ? `/api/og?all=1` : `/api/og`;
        return (
          <div onClick={() => setShareOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, overflowY: "auto" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#0e1218", border: "1px solid #1e2a38", maxWidth: 560, width: "100%", padding: "24px 24px 20px" }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 4 }}>Share This Stat</div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#e8edf5" }}>
                    {active ? `${active.flag} ${active.name}` : `${displayedActive.length} Active Conflict${displayedActive.length !== 1 ? "s" : ""}${region !== "All" ? ` · ${region}` : ""}`}
                  </div>
                </div>
                <button onClick={() => setShareOpen(false)} style={{ background: "transparent", border: "none", color: "#3d4a5a", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>✕</button>
              </div>

              {/* OG Card preview */}
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>Share Card Preview</div>
              <div style={{ background: "#070a0d", border: "1px solid #1a2030", marginBottom: 14, overflow: "hidden", position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogUrl}
                  alt="Share card preview"
                  style={{ width: "100%", display: "block", aspectRatio: "1200/630" }}
                />
              </div>

              {/* Shareable text (compact) */}
              <div style={{ background: "#070a0d", border: "1px solid #1a2030", padding: "10px 14px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#7a8fa8", whiteSpace: "pre-wrap", lineHeight: 1.7, marginBottom: 14 }}>
                {shareText}
              </div>

              {/* Share buttons — 3×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#000", border: "1px solid #333", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  𝕏 X
                </a>
                <a href={linkedIn} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#0a66c2", border: "1px solid #0a66c2", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  in LinkedIn
                </a>
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#1877f2", border: "1px solid #1877f2", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  f Facebook
                </a>
                <a href={redditUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#ff4500", border: "1px solid #ff4500", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  ⬆ Reddit
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareText).then(() => {
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    });
                  }}
                  style={{ background: shareCopied ? "#1a3a2a" : "#1e2a38", border: `1px solid ${shareCopied ? "#2a5a3a" : "#2a3a50"}`, color: shareCopied ? "#4aaa6a" : "#c8d4e0", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", cursor: "pointer" }}>
                  {shareCopied ? "✓ Copied!" : "⎘ Copy Text"}
                </button>
                <a href={mailUrl}
                  style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✉ Email
                </a>
              </div>

              {/* Instagram row — manual workflow */}
              <button
                onClick={() => {
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  navigator.clipboard.writeText(shareText).catch(() => {});
                  if (isMobile) {
                    // Open image in new tab so user can long-press → Save to Photos
                    window.open(`${SITE}${ogUrl}`, "_blank");
                  } else {
                    window.open("https://www.instagram.com/", "_blank");
                  }
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 3000);
                }}
                style={{ width: "100%", background: "linear-gradient(90deg,#833ab4,#fd1d1d,#fcb045)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 12px", textTransform: "uppercase", cursor: "pointer", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📷 Instagram — {shareCopied ? "Caption Copied! Open Instagram & Post" : "Copy Caption & Open Instagram"}
              </button>

              {/* Download card — full width */}
              <button
                onClick={async () => {
                  const filename = active ? `${active.id}-cost.png` : "conflict-cost.png";
                  const fullOgUrl = `${SITE}${ogUrl}`;
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  if (isMobile) {
                    // Open image in new tab — user long-presses to Save to Photos
                    window.open(fullOgUrl, "_blank");
                  } else {
                    try {
                      const res  = await fetch(fullOgUrl);
                      const blob = await res.blob();
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href     = url;
                      a.download = filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(fullOgUrl, "_blank");
                    }
                  }
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "10px 12px", textTransform: "uppercase", cursor: "pointer" }}>
                ↓&nbsp; {/iPhone|iPad|iPod|Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? "Open Image (Long-Press to Save)" : "Download Card Image"}
              </button>

              <div style={{ marginTop: 14, fontSize: 11, color: "#2d3a4a", lineHeight: 1.7 }}>
                When shared on X, LinkedIn, or Facebook — the card previews automatically.
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
