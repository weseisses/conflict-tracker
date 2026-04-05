import { ImageResponse } from "next/og";
import conflictsData from "../../../../conflicts.config.json";
import type { Conflict, SpendChartConfig, RatePoint } from "../../../../lib/types";

export const runtime = "edge";

const conflicts = conflictsData as Conflict[];

// ─── Cost helpers ─────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function calcCost(c: Conflict, now: Date): number {
  const start   = new Date(c.startDate + "T00:00:00Z");
  const ceiling = c.endDate ? new Date(c.endDate + "T00:00:00Z") : now;
  const eff     = ceiling < now ? ceiling : now;
  return (c.anchor || 0) + Math.max(0, eff.getTime() - start.getTime()) / DAY_MS * c.ratePerDay;
}

function fmtB(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

// ─── Chart data ───────────────────────────────────────────────────────────────
function getCumAt(
  targetTs: number, startTs: number,
  rateHistory: RatePoint[], defaultRate: number, partyKey?: string,
): number {
  if (targetTs <= startTs) return 0;
  const sorted = [...rateHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

/** Returns N evenly-spaced cumulative-billions values + per-party map */
function buildSeries(c: Conflict, chart: SpendChartConfig, now: Date, N = 50) {
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

/** Build SVG polyline points string from a series */
function toPolyline(
  series: number[], maxB: number,
  cw: number, ch: number, ox: number, oy: number,
): string {
  const N = series.length;
  return series
    .map((v, i) => {
      const x = (ox + (i / (N - 1)) * cw).toFixed(1);
      const y = (oy + ch - (v / maxB) * ch).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
}

/** Build a closed area path (line + bottom) */
function toAreaPath(
  series: number[], maxB: number,
  cw: number, ch: number, ox: number, oy: number,
): string {
  const N   = series.length;
  const bot = oy + ch;
  const pts = series.map((v, i) => {
    const x = (ox + (i / (N - 1)) * cw).toFixed(1);
    const y = (oy + ch - (v / maxB) * ch).toFixed(1);
    return `${x},${y}`;
  });
  return `M${ox.toFixed(1)},${bot} L${pts.join(" L")} L${(ox + cw).toFixed(1)},${bot} Z`;
}

// Y tick values
function yTicks(maxB: number): number[] {
  const STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 750, 1000, 1500];
  const step  = STEPS.find(s => maxB / s >= 3 && maxB / s <= 6) ??
                STEPS.find(s => maxB / s <= 6) ?? 500;
  const out: number[] = [];
  for (let v = step; v <= maxB * 1.05; v += step) out.push(v);
  return out;
}

// X year labels
function xYearLabels(ts: number[]): { pct: number; label: string }[] {
  const out: { pct: number; label: string }[] = [];
  const spanMs = ts[ts.length - 1] - ts[0];
  let lastYear = -1;
  ts.forEach((t, i) => {
    const y = new Date(t).getUTCFullYear();
    if (y !== lastYear) { lastYear = y; out.push({ pct: i / (ts.length - 1), label: String(y) }); }
  });
  return out;
}

// Font loader (same as main og route)
async function loadFont(reqUrl: string): Promise<ArrayBuffer | null> {
  try {
    const base = new URL(reqUrl);
    const fontUrl = `${base.protocol}//${base.host}/fonts/bold.ttf`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(fontUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 1000) return buf;
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Image dimensions & layout ────────────────────────────────────────────────
const W = 1200, H = 630;

// Chart area within the image
const CX = 80,  CY = 160;   // top-left of chart
const CW = 920, CH = 310;   // chart width / height
const CHART_RIGHT = CX + CW;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const conflict = conflicts.find(c => c.id === id);
  if (!conflict || !conflict.spendChart) return new Response("Not found", { status: 404 });

  const chart   = conflict.spendChart;
  const now     = new Date();
  const asOf    = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  const totalCost = calcCost(conflict, now);
  const accent  = conflict.color || "#3b82f6";

  const fontData = await loadFont(request.url);
  const fonts = fontData
    ? [{ name: "F", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "F, sans-serif" : "sans-serif";

  // Build series
  const { ts, combined, parties } = buildSeries(conflict, chart, now);
  const activePts = chart.parties.filter(p => p.confidence !== "none" && parties[p.key]);
  const isMulti   = chart.mode === "multi" && activePts.length > 0;

  const maxB = Math.max(...combined, ...Object.values(parties).flat()) * 1.1;
  const ticks = yTicks(maxB);
  const xlabs = xYearLabels(ts);

  // Polylines
  const combinedPoly = toPolyline(combined, maxB, CW, CH, CX, CY);
  const combinedArea = toAreaPath(combined, maxB, CW, CH, CX, CY);

  const partyPolys = activePts.map(p => ({
    ...p,
    poly: toPolyline(parties[p.key], maxB, CW, CH, CX, CY),
    area: toAreaPath(parties[p.key], maxB, CW, CH, CX, CY),
  }));

  // Source string
  const sourceStr = chart.parties.some(p => p.confidence === "high")
    ? "SIPRI · CSIS · Kiel Institute · Pentagon · conflictcost.org"
    : "SIPRI · ACLED · Brown Univ. Costs of War · conflictcost.org";

  return new ImageResponse((
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H,
                  background: "#080b10", fontFamily: ff, position: "relative" }}>

      {/* Accent stripe */}
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0,
                    width: W, height: 5, background: accent }} />

      {/* ── HEADER ── */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between",
                    alignItems: "center", padding: "22px 48px 0" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", background: "#e74c3c", color: "#fff",
                        fontSize: 12, fontWeight: 800, letterSpacing: 3, padding: "3px 10px" }}>
            GLOBAL
          </div>
          <div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 3, color: "#4a6070" }}>
            CONFLICT COST TRACKER
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#3d4a58" }}>
            AS OF {asOf}
          </div>
          <div style={{ display: "flex", fontSize: 11, color: "#2a3a48" }}>·</div>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#3d4a58" }}>
            conflictcost.org
          </div>
        </div>
      </div>

      {/* ── CONFLICT NAME + TOTAL ── */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline",
                    gap: 16, padding: "14px 48px 0" }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "#e8edf5", letterSpacing: 1 }}>
          {conflict.name.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: accent }}>
          {fmtB(totalCost)}
        </div>
        <div style={{ display: "flex", fontSize: 11, letterSpacing: 3,
                      color: conflict.status === "ACTIVE" ? "#e74c3c" : "#4a5568",
                      border: `1px solid ${conflict.status === "ACTIVE" ? "#e74c3c44" : "#2a3040"}`,
                      padding: "3px 8px" }}>
          {conflict.status}
        </div>
        <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#2d3a4a", marginLeft: 4 }}>
          {isMulti ? "EXPENDITURE BY PARTY" : "COMBINED · ALL PARTIES"}
        </div>
      </div>

      {/* ── SVG CHART ── */}
      <div style={{ display: "flex", position: "absolute",
                    top: CY, left: 0, width: W, height: CH + 30 }}>
        <svg
          width={W} height={CH + 30}
          viewBox={`0 0 ${W} ${CH + 30}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {/* Grid lines */}
          {ticks.map(t => {
            const y = (CH - (t / maxB) * CH).toFixed(1);
            return (
              <g key={t}>
                <line x1={CX} y1={y} x2={CHART_RIGHT} y2={y}
                      stroke="#1a2030" strokeWidth="1" />
                <text x={CX - 8} y={parseFloat(y) + 4}
                      textAnchor="end" fontSize="10" fill="#374151" fontFamily="monospace">
                  {fmtB(t)}
                </text>
              </g>
            );
          })}

          {/* X labels */}
          {xlabs.map(({ pct, label }) => (
            <text key={label}
                  x={(CX + pct * CW).toFixed(1)} y={CH + 22}
                  textAnchor="middle" fontSize="11" fill="#374151" fontFamily="monospace">
              {label}
            </text>
          ))}

          {/* Area fills */}
          {!isMulti && (
            <path d={combinedArea} fill={accent} fillOpacity="0.08" />
          )}
          {isMulti && partyPolys.map(p => (
            <path key={p.key} d={p.area} fill={p.color} fillOpacity="0.07" />
          ))}

          {/* Lines */}
          {!isMulti && (
            <polyline points={combinedPoly} fill="none" stroke={accent} strokeWidth="2.5" />
          )}
          {isMulti && partyPolys.map(p => (
            <polyline key={p.key} points={p.poly} fill="none" stroke={p.color} strokeWidth="2.5" />
          ))}
        </svg>
      </div>

      {/* ── PARTY LEGEND (multi) or single label ── */}
      <div style={{
        display: "flex", flexDirection: "row", gap: 32, alignItems: "center",
        position: "absolute",
        top: CY + CH + 36,
        left: 48,
      }}>
        {isMulti
          ? partyPolys.map(p => (
              <div key={p.key} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", width: 28, height: 3, background: p.color, borderRadius: 2 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: p.color, letterSpacing: 1 }}>
                    {p.name.toUpperCase()}
                  </div>
                  {p.estimate && (
                    <div style={{ display: "flex", fontSize: 10, color: "#374151" }}>
                      {fmtB(p.estimate.mid)} est.
                    </div>
                  )}
                </div>
              </div>
            ))
          : (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", width: 28, height: 3, background: accent, borderRadius: 2 }} />
              <div style={{ display: "flex", fontSize: 11, color: "#4a5568", letterSpacing: 1 }}>
                COMBINED · ALL PARTIES
              </div>
            </div>
          )
        }
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        position: "absolute", bottom: 22, left: 48, right: 48,
        borderTop: "1px solid #1a2030", paddingTop: 14,
      }}>
        <div style={{ display: "flex", fontSize: 11, color: "#2d3a4a", letterSpacing: 1 }}>
          Cumulative direct military expenditure — all major parties · estimates only
        </div>
        <div style={{ display: "flex", fontSize: 10, color: "#2d3a4a", letterSpacing: 1.5 }}>
          {sourceStr}
        </div>
      </div>

    </div>
  ), { width: W, height: H, fonts });
}
