import { ImageResponse } from "next/og";
import conflictsData from "../../../../conflicts.config.json";
import type { Conflict, SpendChartConfig, RatePoint } from "../../../../lib/types";

export const runtime = "edge";

const conflicts = conflictsData as Conflict[];
const DAY_MS = 86_400_000;
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// ─── Formatters ───────────────────────────────────────────────────────────────

function calcCost(c: Conflict, now: Date): number {
  const start   = new Date(c.startDate + "T00:00:00Z");
  const ceiling = c.endDate ? new Date(c.endDate + "T00:00:00Z") : now;
  const eff     = ceiling < now ? ceiling : now;
  return (c.anchor || 0) + Math.max(0, eff.getTime() - start.getTime()) / DAY_MS * c.ratePerDay;
}

/** Spelled-out for the hero total — e.g. "$1.24 TRILLION" */
function fmtSpelled(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)} TRILLION`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)} BILLION`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)} MILLION`;
  return `$${Math.round(v).toLocaleString()}`;
}

/** Compact for rate boxes — e.g. "$34.4M" */
function fmtRate(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

/** Compact for chart Y axis */
function fmtAxis(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

/** Spelled-out for party cards (value in BILLIONS already) */
function fmtBspelled(b: number): string {
  if (b >= 1000) return `$${(b / 1000).toFixed(2)} TRILLION`;
  if (b >= 1)    return `$${b.toFixed(1)} BILLION`;
  return `$${(b * 1000).toFixed(0)} MILLION`;
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

function buildSeries(c: Conflict, chart: SpendChartConfig, now: Date, N = 60) {
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

// SVG helpers — oy is always 0 since SVG element is already at the right vertical offset
function toPolyline(series: number[], maxB: number, cw: number, ch: number, ox: number): string {
  const N = series.length;
  return series
    .map((v, i) => `${(ox + (i / (N - 1)) * cw).toFixed(1)},${(ch - (v / maxB) * ch).toFixed(1)}`)
    .join(" ");
}

function toAreaPath(series: number[], maxB: number, cw: number, ch: number, ox: number): string {
  const N = series.length;
  const pts = series.map((v, i) =>
    `${(ox + (i / (N - 1)) * cw).toFixed(1)},${(ch - (v / maxB) * ch).toFixed(1)}`
  );
  return `M${ox.toFixed(1)},${ch} L${pts.join(" L")} L${(ox + cw).toFixed(1)},${ch} Z`;
}

function yTicks(maxB: number): number[] {
  const STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 750, 1000, 1500];
  const step  = STEPS.find(s => maxB / s >= 3 && maxB / s <= 6) ??
                STEPS.find(s => maxB / s <= 6) ?? 500;
  const out: number[] = [];
  for (let v = step; v <= maxB * 1.05; v += step) out.push(v);
  return out;
}

function xLabels(ts: number[]): { pct: number; label: string }[] {
  const spanDays = (ts[ts.length - 1] - ts[0]) / DAY_MS;
  const N = ts.length;

  if (spanDays <= 84) {
    // Weekly — "FEB 24"
    let lastWeek = -1;
    return ts.reduce<{ pct: number; label: string }[]>((acc, t, i) => {
      const week = Math.floor((t - ts[0]) / (7 * DAY_MS));
      if (week !== lastWeek) {
        lastWeek = week;
        const d = new Date(t);
        acc.push({ pct: i / (N - 1), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` });
      }
      return acc;
    }, []);
  }

  if (spanDays <= 760) {
    // Monthly — "JAN '22"
    let lastKey = -1;
    return ts.reduce<{ pct: number; label: string }[]>((acc, t, i) => {
      const d = new Date(t);
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

// ─── Font ────────────────────────────────────────────────────────────────────

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
const CX = 72;    // left margin reserved for Y-axis labels
const CW = 1104;  // chart width (W - CX - 24 right pad)

// Heights of fixed sections:
//   accent=4, header=52, name=40, cost=66, gap=10
//   → chart starts at top=172
// For MULTI:  CH=290 → cards at 462+28=490, footer at 586; 586+44=630 ✓
// For SINGLE: CH=386 →             no cards; footer at 586; 586+44=630 ✓
const CHART_TOP = 172;

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
  const asOf   = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  const accent = conflict.color || "#3b82f6";

  const totalCost   = calcCost(conflict, now);
  const ratePerHour = conflict.ratePerDay / 24;
  const ratePerSec  = conflict.ratePerDay / 86400;

  const fontData = await loadFont(request.url);
  const fonts    = fontData
    ? [{ name: "F", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "F, sans-serif" : "sans-serif";

  const { ts, combined, parties } = buildSeries(conflict, chart, now);
  const activePts = chart.parties.filter(p => p.confidence !== "none" && parties[p.key]);
  const isMulti   = chart.mode === "multi" && activePts.length > 0;

  const maxB  = Math.max(...combined, ...Object.values(parties).flat()) * 1.1;
  const ticks = yTicks(maxB);
  const xlabs = xLabels(ts);

  const CH = isMulti ? 290 : 386;

  // Polylines — oy=0 because SVG is already positioned at CHART_TOP
  const combinedPoly = toPolyline(combined, maxB, CW, CH, CX);
  const combinedArea = toAreaPath(combined, maxB, CW, CH, CX);
  const partyPolys   = activePts.map(p => ({
    ...p,
    poly: toPolyline(parties[p.key], maxB, CW, CH, CX),
    area: toAreaPath(parties[p.key], maxB, CW, CH, CX),
  }));

  // Vertical positions
  const xlabTop   = CHART_TOP + CH + 4;
  const cardsTop  = CHART_TOP + CH + 28;
  const footerTop = 586; // = cardsTop(multi)+96 = cardsTop(single)+0 → both land at 586

  const sourceStr = chart.parties.some(p => p.confidence === "high")
    ? "SIPRI · CSIS · Kiel Institute · Pentagon"
    : "SIPRI · ACLED · Brown Univ. Costs of War";

  return new ImageResponse((
    <div style={{
      display: "flex", width: W, height: H,
      background: "#080b10", fontFamily: ff,
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Accent stripe ── */}
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: 4, background: accent }} />

      {/* ── Header ── */}
      <div style={{
        display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        position: "absolute", top: 4, left: 0, width: W, height: 52, padding: "0 48px",
      }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", background: "#e74c3c", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 3, padding: "3px 10px" }}>
            GLOBAL
          </div>
          <div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 3, color: "#4a6070" }}>
            CONFLICT COST TRACKER
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#3d4a58" }}>AS OF {asOf}</div>
          <div style={{ display: "flex", fontSize: 11, color: "#2a3a48" }}>·</div>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#3d4a58" }}>conflictcost.org</div>
        </div>
      </div>

      {/* ── Conflict name + status ── */}
      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center", gap: 14,
        position: "absolute", top: 56, left: 48, right: 48, height: 40,
      }}>
        <div style={{ display: "flex", fontSize: 20, fontWeight: 800, color: "#e8edf5", letterSpacing: 1 }}>
          {conflict.flag} {conflict.name.toUpperCase()}
        </div>
        <div style={{
          display: "flex", fontSize: 10, letterSpacing: 3, padding: "2px 8px",
          color: conflict.status === "ACTIVE" ? "#e74c3c" : "#4a5568",
          border: `1px solid ${conflict.status === "ACTIVE" ? "#e74c3c55" : "#2a3040"}`,
        }}>
          {conflict.status}
        </div>
        <div style={{ display: "flex", fontSize: 10, letterSpacing: 2, color: "#2d3a4a" }}>
          {isMulti ? "EXPENDITURE BY PARTY" : "COMBINED · ALL PARTIES"}
        </div>
      </div>

      {/* ── Cost hero + hourly rate boxes ── */}
      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center", gap: 18,
        position: "absolute", top: 96, left: 48, right: 48, height: 66,
      }}>
        {/* Big spelled-out total */}
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: accent, letterSpacing: -0.5, lineHeight: 1 }}>
          {fmtSpelled(totalCost)}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        {/* /HOUR box */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          background: "#0d1520", border: `1px solid ${accent}44`, padding: "8px 20px",
        }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: accent }}>
            {fmtRate(ratePerHour)}
          </div>
          <div style={{ display: "flex", fontSize: 9, fontWeight: 700, letterSpacing: 3, color: "#3d4a58" }}>
            / HOUR
          </div>
        </div>
        {/* /SEC box */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          background: "#0a0d12", border: "1px solid #1a2030", padding: "8px 20px",
        }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: "#4a6070" }}>
            {fmtRate(ratePerSec)}
          </div>
          <div style={{ display: "flex", fontSize: 9, fontWeight: 700, letterSpacing: 3, color: "#2d3840" }}>
            / SEC
          </div>
        </div>
      </div>

      {/* ── Y-axis labels ── */}
      {ticks.map(t => (
        <div key={t} style={{
          display: "flex",
          position: "absolute",
          top: CHART_TOP + Math.round((1 - t / maxB) * CH) - 7,
          left: 0, width: CX - 8,
          justifyContent: "flex-end",
          fontSize: 10, color: "#374151", fontFamily: "monospace",
        }}>
          {fmtAxis(t)}
        </div>
      ))}

      {/* ── SVG chart (grid + lines + areas) ── */}
      <div style={{ display: "flex", position: "absolute", top: CHART_TOP, left: 0, width: W, height: CH }}>
        <svg width={W} height={CH} viewBox={`0 0 ${W} ${CH}`} style={{ position: "absolute", top: 0, left: 0 }}>
          {/* Grid lines */}
          {ticks.map(t => {
            const y = (CH - (t / maxB) * CH).toFixed(1);
            return <line key={t} x1={CX} y1={y} x2={CX + CW} y2={y} stroke="#1a2030" strokeWidth="1" />;
          })}
          {/* Area fills */}
          {!isMulti && <path d={combinedArea} fill={accent} fillOpacity="0.09" />}
          {isMulti && partyPolys.map(p => (
            <path key={p.key} d={p.area} fill={p.color} fillOpacity="0.07" />
          ))}
          {/* Lines */}
          {!isMulti && (
            <polyline points={combinedPoly} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {isMulti && partyPolys.map(p => (
            <polyline key={p.key} points={p.poly} fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>

      {/* ── X-axis labels ── */}
      {xlabs.map(({ pct, label }) => (
        <div key={label} style={{
          display: "flex", position: "absolute",
          top: xlabTop, left: Math.round(CX + pct * CW) - 26,
          width: 52, justifyContent: "center",
          fontSize: 10, color: "#374151", fontFamily: "monospace",
        }}>
          {label}
        </div>
      ))}

      {/* ── Party cards (multi only) ── */}
      {isMulti && (
        <div style={{
          display: "flex", flexDirection: "row",
          position: "absolute", top: cardsTop, left: 0, right: 0, height: 96,
          borderTop: "1px solid #1a2030",
        }}>
          {chart.parties.map((p, i) => {
            const cs      = CS[p.confidence];
            const figure  = p.estimate ? fmtBspelled(p.estimate.mid) : "—";
            const figColor = p.confidence === "none" || !p.estimate ? "#374151" : p.color;
            return (
              <div key={p.key} style={{
                display: "flex", flexDirection: "column", flex: 1,
                padding: "10px 20px",
                borderRight: i < chart.parties.length - 1 ? "1px solid #1a2030" : "none",
                borderTop: `2px solid ${p.confidence === "none" ? "#1f2937" : p.color}`,
                opacity: p.confidence === "none" ? 0.6 : 1,
                gap: 5,
              }}>
                {/* Name · figure · confidence pill */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: "#d1d9e0", letterSpacing: 0.5 }}>
                    {p.name.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", fontSize: 16, fontWeight: 800, color: figColor }}>
                    {figure}
                  </div>
                  <div style={{
                    display: "flex", fontSize: 8, fontWeight: 700, letterSpacing: 1,
                    padding: "2px 5px",
                    background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color,
                  }}>
                    {cs.label}
                  </div>
                </div>
                {/* Short explainer */}
                <div style={{
                  display: "flex", fontSize: 10, color: "#4a5568", lineHeight: 1.5,
                  overflow: "hidden",
                }}>
                  {p.explainer.length > 120 ? p.explainer.slice(0, 117) + "..." : p.explainer}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        position: "absolute", top: footerTop, left: 48, right: 48, height: 44,
        borderTop: "1px solid #131c28",
      }}>
        <div style={{ display: "flex", fontSize: 11, color: "#2a3440", letterSpacing: 1 }}>
          Cumulative direct military expenditure · estimates only
        </div>
        <div style={{ display: "flex", fontSize: 10, color: "#2a3440", letterSpacing: 1.5 }}>
          {sourceStr}
        </div>
      </div>

    </div>
  ), { width: W, height: H, fonts });
}
