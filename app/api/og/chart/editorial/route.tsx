/**
 * /api/og/chart/editorial?id=[conflictId]
 *
 * Reddit / r/dataisbeautiful optimised version of the chart share image.
 * Editorial style — no product chrome, no dashboard UI.
 * Hierarchy: Title → Sub → Chart → Legend → Source
 */
import { ImageResponse } from "next/og";
import conflictsData from "../../../../../conflicts.config.json";
import type { Conflict, SpendChartConfig, RatePoint } from "../../../../../lib/types";

export const runtime = "edge";

const conflicts = conflictsData as Conflict[];
const DAY_MS = 86_400_000;
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Y-axis labels — compact, starts from 0 */
function fmtAxis(b: number): string {
  if (b === 0) return "$0";
  if (b >= 1000) return `$${b / 1000}T`;
  return `$${b}B`;
}

/** Legend card figure — "~$630B" rounded to nearest 10 */
function fmtCard(b: number): string {
  if (b < 0.1) return "—";
  if (b >= 1000) return `~$${(b / 1000).toFixed(1)}T`;
  if (b < 10) return `~$${b.toFixed(1)}B`;
  const rounded = b < 50 ? Math.round(b / 5) * 5 : Math.round(b / 10) * 10;
  return `~$${rounded}B`;
}

// ─── Chart maths ─────────────────────────────────────────────────────────────

function getCumAt(
  targetTs: number, startTs: number,
  rh: RatePoint[], defaultRate: number, partyKey?: string,
): number {
  if (targetTs <= startTs) return 0;
  const sorted = [...rh].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let cum = 0, prev = startTs, rate = partyKey ? 0 : defaultRate;
  for (const rp of sorted) {
    const rpTs = new Date(rp.date + "T00:00:00Z").getTime();
    if (rpTs >= targetTs) break;
    cum  += (rate / 1e9) * ((Math.min(rpTs, targetTs) - prev) / DAY_MS);
    rate  = partyKey ? (rp.rates?.[partyKey] ?? rate) : (rp.rate ?? rate);
    prev  = rpTs;
  }
  cum += (rate / 1e9) * ((targetTs - prev) / DAY_MS);
  return Math.max(0, cum);
}

function buildSeries(c: Conflict, chart: SpendChartConfig, now: Date, N = 80) {
  const startTs = new Date(c.startDate + "T00:00:00Z").getTime();
  const endTs   = c.endDate ? new Date(c.endDate + "T00:00:00Z").getTime() : now.getTime();
  const ts      = Array.from({ length: N }, (_, i) => startTs + (i / (N - 1)) * (endTs - startTs));
  const rh      = chart.rateHistory ?? [];

  const combined = ts.map(t =>
    rh.length > 0
      ? getCumAt(t, startTs, rh, c.ratePerDay)
      : c.anchor / 1e9 + ((t - startTs) / DAY_MS) * (c.ratePerDay / 1e9),
  );

  const parties: Record<string, number[]> = {};
  if (chart.mode === "multi" && rh.length > 0) {
    for (const p of chart.parties) {
      if (p.confidence !== "none") {
        parties[p.key] = ts.map(t => getCumAt(t, startTs, rh, 0, p.key));
      }
    }
  }
  return { ts, combined, parties };
}

// oy=0 — SVG is already offset to the chart area
function toPolyline(series: number[], maxB: number, cw: number, ch: number, ox: number): string {
  const N = series.length;
  return series
    .map((v, i) => `${(ox + (i / (N - 1)) * cw).toFixed(1)},${(ch - (v / maxB) * ch).toFixed(1)}`)
    .join(" ");
}

function toAreaPath(series: number[], maxB: number, cw: number, ch: number, ox: number): string {
  const N   = series.length;
  const pts = series.map((v, i) =>
    `${(ox + (i / (N - 1)) * cw).toFixed(1)},${(ch - (v / maxB) * ch).toFixed(1)}`
  );
  return `M${ox.toFixed(1)},${ch} L${pts.join(" L")} L${(ox + cw).toFixed(1)},${ch} Z`;
}

/**
 * Y-axis ticks always starting from 0.
 * Finds a step that gives 4-7 gridlines, returns ticks + the maxB with headroom.
 */
function editorialYTicks(rawMax: number): { maxB: number; ticks: number[] } {
  const STEPS = [25, 50, 100, 150, 200, 250, 500, 750, 1000];
  const step  = STEPS.find(s => rawMax / s >= 3 && rawMax / s <= 7) ??
                STEPS.find(s => rawMax / s <= 7) ?? 250;
  const maxB  = rawMax * 1.12; // 12% headroom so top line doesn't clip
  const ticks: number[] = [0];
  for (let v = step; v < maxB; v += step) ticks.push(v);
  return { maxB, ticks };
}

function xLabels(ts: number[]): { pct: number; label: string }[] {
  const spanDays = (ts[ts.length - 1] - ts[0]) / DAY_MS;
  const N        = ts.length;

  if (spanDays <= 84) {
    let lastWeek = -1;
    return ts.reduce<{ pct: number; label: string }[]>((acc, t, i) => {
      const w = Math.floor((t - ts[0]) / (7 * DAY_MS));
      if (w !== lastWeek) {
        lastWeek = w;
        const d = new Date(t);
        acc.push({ pct: i / (N - 1), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` });
      }
      return acc;
    }, []);
  }

  if (spanDays <= 760) {
    let lastKey = -1;
    return ts.reduce<{ pct: number; label: string }[]>((acc, t, i) => {
      const d   = new Date(t);
      const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (key !== lastKey) {
        lastKey = key;
        acc.push({ pct: i / (N - 1), label: `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}` });
      }
      return acc;
    }, []);
  }

  // Yearly
  let lastYear = -1;
  return ts.reduce<{ pct: number; label: string }[]>((acc, t, i) => {
    const y = new Date(t).getUTCFullYear();
    if (y !== lastYear) { lastYear = y; acc.push({ pct: i / (N - 1), label: String(y) }); }
    return acc;
  }, []);
}

async function loadFont(reqUrl: string): Promise<ArrayBuffer | null> {
  try {
    const base    = new URL(reqUrl);
    const fontUrl = `${base.protocol}//${base.host}/fonts/bold.ttf`;
    const ctrl    = new AbortController();
    const t       = setTimeout(() => ctrl.abort(), 8000);
    const res     = await fetch(fontUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 1000) return buf;
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const W  = 1200;
const H  = 630;
const CX = 76;    // left margin for Y labels
const CW = 1100;  // chart draw width (W - CX - 24 right pad)

// Pixel-perfect layout (must sum to H=630):
//
//   Accent stripe:  top=0,    h=3   → ends at 3
//   Title block:    top=3,    h=92  → ends at 95
//   [chart top = 95]
//   Chart SVG:      top=95,   h=CH
//   X labels:       top=95+CH+6,   h=20
//   Legend cards:   top=95+CH+32,  h=76   (multi only)
//   Divider+footer: top=95+CH+32+76+5 = 95+CH+113 for multi
//
//   MULTI  CH=348 → footer_top = 95+348+113 = 556, footer h=74  → 630 ✓
//   SINGLE CH=440 → footer_top = 95+440+32  = 567, footer h=63  → 630 ✓
//                   (no legend cards for single)

const CS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: "SOURCED",     color: "#4ade80", bg: "#052e16", border: "#166534" },
  medium: { label: "ESTIMATED",   color: "#fbbf24", bg: "#422006", border: "#92400e" },
  none:   { label: "UNDISCLOSED", color: "#4b5563", bg: "#111827", border: "#1f2937" },
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const conflict = conflicts.find(c => c.id === id);
  if (!conflict || !conflict.spendChart) return new Response("Not found", { status: 404 });

  const chart  = conflict.spendChart;
  const now    = new Date();
  const accent = conflict.color || "#3b82f6";

  const fontData = await loadFont(request.url);
  const fonts    = fontData
    ? [{ name: "F", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "F, sans-serif" : "sans-serif";

  // Series
  const { ts, combined, parties } = buildSeries(conflict, chart, now);
  const activePts = chart.parties.filter(p => p.confidence !== "none" && parties[p.key]);
  const isMulti   = chart.mode === "multi" && activePts.length > 0;

  // Y axis
  const allVals       = [...combined, ...Object.values(parties).flat()];
  const rawMax        = Math.max(...allVals);
  const { maxB, ticks } = editorialYTicks(rawMax);
  const xlabs         = xLabels(ts);

  // Chart height
  const CH = isMulti ? 348 : 440;

  // Polylines
  const partyPolys = activePts.map(p => ({
    ...p,
    poly: toPolyline(parties[p.key], maxB, CW, CH, CX),
    area: toAreaPath(parties[p.key], maxB, CW, CH, CX),
  }));
  const combinedPoly = !isMulti ? toPolyline(combined, maxB, CW, CH, CX) : null;
  const combinedArea = !isMulti ? toAreaPath(combined, maxB, CW, CH, CX) : null;

  // Current cumulative figure per active party (billions)
  const startTs = new Date(conflict.startDate + "T00:00:00Z").getTime();
  const rh      = chart.rateHistory ?? [];
  const liveFigures: Record<string, number> = {};
  for (const p of activePts) {
    liveFigures[p.key] = getCumAt(now.getTime(), startTs, rh, 0, p.key);
  }

  // Editorial title
  const startYear = new Date(conflict.startDate + "T00:00:00Z").getUTCFullYear();
  const endYear   = conflict.endDate
    ? new Date(conflict.endDate + "T00:00:00Z").getUTCFullYear()
    : now.getUTCFullYear();
  const titleMode   = isMulti ? "cumulative military expenditure by party" : "military expenditure over time";
  const editTitle   = `${conflict.name}: ${titleMode} (${startYear}–${endYear})`;

  // As-of date (small, in subtext)
  const asOf = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Vertical positions
  const CHART_TOP  = 95;
  const XLAB_TOP   = CHART_TOP + CH + 6;
  const CARDS_TOP  = CHART_TOP + CH + 32;
  const FOOTER_TOP = isMulti ? CARDS_TOP + 76 + 5 : CARDS_TOP;
  //   Multi:  95+348+32+76+5 = 556 → footer h=74 → 630 ✓
  //   Single: 95+440+32      = 567 → footer h=63 → 630 ✓

  return new ImageResponse((
    <div style={{
      display: "flex", width: W, height: H,
      background: "#080b10", fontFamily: ff,
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Thin accent bar ── */}
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: 3, background: accent }} />

      {/* ── Editorial title block ── */}
      <div style={{
        display: "flex", flexDirection: "column",
        position: "absolute", top: 3, left: 56, right: 56, height: 92,
        justifyContent: "center", gap: 8,
      }}>
        {/* Main title */}
        <div style={{
          display: "flex", fontSize: 26, fontWeight: 800,
          color: "#dde4ed", lineHeight: 1.2,
        }}>
          {editTitle}
        </div>
        {/* Subtitle row: unit + as-of + attribution */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 13, color: "#4a6070", letterSpacing: 0.5 }}>
            USD (billions)
          </div>
          <div style={{ display: "flex", fontSize: 11, color: "#2d3a4a" }}>·</div>
          <div style={{ display: "flex", fontSize: 11, color: "#2d3a4a", letterSpacing: 1 }}>
            as of {asOf}
          </div>
          <div style={{ display: "flex", fontSize: 11, color: "#2d3a4a" }}>·</div>
          <div style={{ display: "flex", fontSize: 11, color: "#2d3a4a", letterSpacing: 1 }}>
            conflictcost.org
          </div>
        </div>
      </div>

      {/* ── Y-axis labels ── */}
      {ticks.map(t => (
        <div key={t} style={{
          display: "flex", position: "absolute",
          top: CHART_TOP + Math.round((1 - t / maxB) * CH) - 8,
          left: 0, width: CX - 8,
          justifyContent: "flex-end",
          fontSize: 11, color: "#374151", fontFamily: "monospace",
        }}>
          {fmtAxis(t)}
        </div>
      ))}

      {/* ── SVG Chart ── */}
      <div style={{ display: "flex", position: "absolute", top: CHART_TOP, left: 0, width: W, height: CH }}>
        <svg width={W} height={CH} viewBox={`0 0 ${W} ${CH}`} style={{ position: "absolute", top: 0, left: 0 }}>

          {/* Grid lines — baseline ($0) slightly more visible */}
          {ticks.map(t => {
            const y       = (CH - (t / maxB) * CH).toFixed(1);
            const isZero  = t === 0;
            return (
              <line key={t}
                x1={CX} y1={y} x2={CX + CW} y2={y}
                stroke={isZero ? "#2e3d50" : "#18222e"}
                strokeWidth={isZero ? "1.5" : "1"}
              />
            );
          })}

          {/* Area fills — subtle under each line */}
          {!isMulti && combinedArea && (
            <path d={combinedArea} fill={accent} fillOpacity="0.08" />
          )}
          {isMulti && partyPolys.map(p => (
            <path key={p.key} d={p.area} fill={p.color} fillOpacity="0.07" />
          ))}

          {/* Lines — 3px for editorial weight (+20% vs dashboard 2.5px) */}
          {!isMulti && combinedPoly && (
            <polyline
              points={combinedPoly} fill="none"
              stroke={accent} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {isMulti && partyPolys.map(p => (
            <polyline
              key={p.key} points={p.poly} fill="none"
              stroke={p.color} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
            />
          ))}

        </svg>
      </div>

      {/* ── X-axis labels ── */}
      {xlabs.map(({ pct, label }) => (
        <div key={label} style={{
          display: "flex", position: "absolute",
          top: XLAB_TOP, left: Math.round(CX + pct * CW) - 22,
          width: 46, justifyContent: "center",
          fontSize: 11, color: "#374151", fontFamily: "monospace",
        }}>
          {label}
        </div>
      ))}

      {/* ── Legend / summary cards (multi only) ── */}
      {isMulti && (
        <div style={{
          display: "flex", flexDirection: "row",
          position: "absolute", top: CARDS_TOP, left: 0, right: 0, height: 76,
          borderTop: "1px solid #182230",
        }}>
          {chart.parties.map((p, i) => {
            const cs      = CS[p.confidence];
            const figB    = (p.confidence !== "none" && liveFigures[p.key])
              ? liveFigures[p.key]
              : (p.estimate?.mid ?? 0);
            const figure  = fmtCard(figB);
            const figCol  = p.confidence === "none" ? "#4a5568" : p.color;
            const isLast  = i === chart.parties.length - 1;

            return (
              <div key={p.key} style={{
                display: "flex", flex: 1,
                flexDirection: "row", alignItems: "center", gap: 12,
                padding: "0 28px",
                borderRight: isLast ? "none" : "1px solid #182230",
                borderTop: `3px solid ${p.confidence === "none" ? "#1f2937" : p.color}`,
                opacity: p.confidence === "none" ? 0.55 : 1,
              }}>
                {/* Colour swatch (line key) */}
                <div style={{ display: "flex", width: 22, height: 3, background: p.confidence === "none" ? "#374151" : p.color, borderRadius: 2, flexShrink: 0 }} />
                {/* Name */}
                <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#7a8fa8", letterSpacing: 0.5, flexShrink: 0 }}>
                  {p.name.toUpperCase()}
                </div>
                {/* Figure */}
                <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: figCol, letterSpacing: -0.5 }}>
                  {figure}
                </div>
                {/* Confidence pill */}
                <div style={{
                  display: "flex", fontSize: 8, fontWeight: 700, letterSpacing: 1.5,
                  padding: "2px 6px", flexShrink: 0,
                  background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color,
                }}>
                  {cs.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer: source citation ── */}
      <div style={{
        display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        position: "absolute", top: FOOTER_TOP, left: 56, right: 56,
        borderTop: "1px solid #131c28", paddingTop: 14,
      }}>
        <div style={{ display: "flex", fontSize: 12, color: "#2d3a4a", letterSpacing: 0.8 }}>
          Sources: SIPRI, ACLED, Brown Costs of War · estimates only
        </div>
        <div style={{ display: "flex", fontSize: 11, color: "#232d38", letterSpacing: 1 }}>
          conflictcost.org
        </div>
      </div>

    </div>
  ), { width: W, height: H, fonts });
}
