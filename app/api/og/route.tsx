import { ImageResponse } from "next/og";
import conflictsData from "../../../conflicts.config.json";
import type { Conflict } from "../../../lib/types";

// MUST be edge — next/og uses Satori+WASM which only bundles correctly on edge
export const runtime = "edge";

const conflicts = conflictsData as Conflict[];

function calcCost(c: Conflict, now: Date): number {
  const start   = new Date(c.startDate + "T00:00:00Z");
  const ceiling = c.endDate ? new Date(c.endDate + "T00:00:00Z") : now;
  const eff     = ceiling < now ? ceiling : now;
  const ms      = eff.getTime() - start.getTime();
  if (ms < 0) return 0;
  return (c.anchor || 0) + (ms / 86_400_000) * c.ratePerDay;
}

function fmtBig(n: number): { val: string; unit: string } {
  if (n >= 1e12) return { val: (n / 1e12).toFixed(3), unit: "TRILLION" };
  if (n >= 1e9)  return { val: (n / 1e9).toFixed(3),  unit: "BILLION"  };
  return { val: Math.round(n).toLocaleString(), unit: "" };
}

function fmtRate(n: number): string {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n).toLocaleString();
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#e74c3c",
  CEASEFIRE: "#f39c12",
  FROZEN:    "#4a90d9",
  ENDED:     "#4a5568",
};

async function loadFont(reqUrl: string): Promise<ArrayBuffer | null> {
  // Satori ONLY supports OTF/TTF — never woff/woff2.
  // Primary: fetch bold.ttf from our own static files (committed to public/fonts/).
  // This has zero external dependency and is guaranteed to be a valid TTF.
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
  return null; // Satori will use built-in Noto Sans as last resort
}

const W = 1200, H = 630;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get("id");
  const now = new Date();

  const fontData = await loadFont(request.url);
  const fonts = fontData
    ? [{ name: "F", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "F, sans-serif" : "sans-serif";

  const region     = searchParams.get("region"); // e.g. "Europe", "Middle East"
  const includeAll = searchParams.get("all") === "1"; // include ended/frozen/ceasefire
  const conflict   = id ? conflicts.find(c => c.id === id) ?? null : null;
  const asOf = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

  // ─── SINGLE CONFLICT — 2× retina (2400×1260), centred layout ────────────
  if (conflict) {
    const S  = 2;
    const SW = 1200 * S;   // 2400
    const SH = 630  * S;   // 1260

    const cost    = calcCost(conflict, now);
    const cFmt    = fmtBig(cost);
    const hourly  = fmtRate(conflict.ratePerDay / 24);
    const daily   = fmtRate(conflict.ratePerDay);
    const perSec  = fmtRate(conflict.ratePerDay / 86_400);
    const accent  = conflict.color || "#e74c3c";
    const sCl     = STATUS_COLOR[conflict.status] || "#4a5568";
    const started = new Date(conflict.startDate + "T00:00:00Z")
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase();

    // ── Layout constants (all in actual output px = base × S) ──────────────
    //  Dead space reduced ~25% vs. original by:
    //    · Moving CENTER_TOP from 195→158 base (content up, tighter top gap)
    //    · Moving FOOTER_TOP from 592→558 base (footer up, tighter bottom gap)
    //    · Scaling hero number 80→96, hourly 40→48, name 28→32 (fills space)
    //  Dead space: top 114 + bottom 120 = 234 base (was 304, −23 %).
    const CORNER_TOP    = 16  * S;   // top of header corner text
    const FOOTER_TOP    = 558 * S;   // top of footer corner text
    const CENTER_TOP    = 158 * S;   // top of vertically-centred content block

    return new ImageResponse((
      <div style={{ display:"flex", width:SW, height:SH,
                    background:"#080b10", fontFamily:ff, position:"relative", overflow:"hidden" }}>

        {/* ── Accent stripe ── */}
        <div style={{ display:"flex", position:"absolute", top:0, left:0,
                      width:SW, height:4*S, background:accent }} />

        {/* ── Top-left: branding ── */}
        <div style={{ display:"flex", position:"absolute", top:CORNER_TOP, left:48*S,
                      flexDirection:"row", alignItems:"center", gap:12*S }}>
          <div style={{ display:"flex", background:"#e74c3c", color:"#fff",
                        fontSize:13*S, fontWeight:800, letterSpacing:3,
                        padding:`${4*S}px ${12*S}px` }}>
            GLOBAL
          </div>
          <div style={{ display:"flex", fontSize:15*S, fontWeight:700,
                        letterSpacing:3, color:"#7a8fa8", fontFamily:ff }}>
            CONFLICT COST TRACKER
          </div>
        </div>

        {/* ── Top-right: date + url ── */}
        <div style={{ display:"flex", position:"absolute", top:CORNER_TOP + 4*S, right:48*S,
                      flexDirection:"row", alignItems:"center", gap:10*S }}>
          <div style={{ display:"flex", fontSize:11*S, letterSpacing:2,
                        color:"#4d5e6e", fontFamily:ff }}>AS OF {asOf}</div>
          <div style={{ display:"flex", fontSize:11*S, color:"#3a4a58", fontFamily:ff }}>·</div>
          <div style={{ display:"flex", fontSize:11*S, letterSpacing:2,
                        color:"#4d5e6e", fontFamily:ff }}>conflictcost.org</div>
        </div>

        {/* ── Centred main content ── */}
        <div style={{ display:"flex", position:"absolute", top:CENTER_TOP,
                      left:0, right:0, flexDirection:"column", alignItems:"center" }}>

          {/* Flag + name + status */}
          <div style={{ display:"flex", flexDirection:"row",
                        alignItems:"center", gap:18*S, marginBottom:20*S }}>
            <span style={{ fontSize:50*S }}>{conflict.flag}</span>
            <div style={{ display:"flex", flexDirection:"column", gap:6*S }}>
              <div style={{ display:"flex", fontSize:32*S, fontWeight:800,
                            color:"#e8edf5", letterSpacing:1, fontFamily:ff }}>
                {conflict.name.toUpperCase()}
              </div>
              <div style={{ display:"flex", flexDirection:"row",
                            alignItems:"center", gap:16*S }}>
                <div style={{ display:"flex", fontSize:11*S, letterSpacing:3,
                              color:"#3d4a5a", fontFamily:ff }}>
                  SINCE {started}
                </div>
                <div style={{ display:"flex", flexDirection:"row",
                              alignItems:"center", gap:6*S }}>
                  <div style={{ display:"flex", width:7*S, height:7*S,
                                borderRadius:"50%", background:sCl }} />
                  <div style={{ display:"flex", fontSize:11*S, letterSpacing:3,
                                color:sCl, fontFamily:ff }}>
                    {conflict.status}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Big cost number */}
          <div style={{ display:"flex", flexDirection:"row",
                        alignItems:"flex-end", gap:4*S, marginBottom:26*S }}>
            <span style={{ display:"flex", fontSize:96*S, color:accent,
                           fontWeight:800, lineHeight:"1", fontFamily:ff }}>$</span>
            <span style={{ display:"flex", fontSize:96*S, color:"#f0f4f8",
                           fontWeight:800, lineHeight:"1", fontFamily:ff }}>
              {cFmt.val}
            </span>
            {cFmt.unit ? (
              <span style={{ display:"flex", fontSize:40*S, color:accent,
                             fontWeight:700, paddingBottom:12*S, marginLeft:10*S,
                             fontFamily:ff }}>
                {cFmt.unit}
              </span>
            ) : null}
          </div>

          {/* Rate boxes */}
          <div style={{ display:"flex", flexDirection:"row",
                        alignItems:"center", gap:24*S }}>
            <div style={{ display:"flex", flexDirection:"column",
                          background:"#152535", borderLeft:`${4*S}px solid ${accent}`,
                          padding:`${12*S}px ${22*S}px`, gap:6*S }}>
              <div style={{ display:"flex", fontSize:48*S, color:"#f39c12",
                            fontWeight:800, fontFamily:ff }}>
                {hourly}
              </div>
              <div style={{ display:"flex", fontSize:10*S, letterSpacing:5,
                            color:"#9a7840", fontFamily:ff }}>
                / HOUR
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12*S }}>
              <div style={{ display:"flex", fontSize:20*S, color:"#5a6a7c", fontFamily:ff }}>
                {daily}
                <span style={{ color:"#4a5a6a", marginLeft:8*S }}> / DAY</span>
              </div>
              <div style={{ display:"flex", fontSize:20*S, color:"#5a6a7c", fontFamily:ff }}>
                {perSec}
                <span style={{ color:"#4a5a6a", marginLeft:8*S }}> / SEC</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom-left: parties ── */}
        <div style={{ display:"flex", position:"absolute", top:FOOTER_TOP, left:48*S,
                      fontSize:12*S, color:"#4d5e6e", letterSpacing:1, fontFamily:ff }}>
          {conflict.parties}
        </div>

        {/* ── Bottom-right: sources ── */}
        <div style={{ display:"flex", position:"absolute", top:FOOTER_TOP, right:48*S,
                      fontSize:11*S, color:"#3a4a58", letterSpacing:2, fontFamily:ff }}>
          SIPRI · ACLED · OHCHR
        </div>

      </div>
    ), { width:SW, height:SH, fonts });
  }

  // ─── GLOBAL / REGIONAL ────────────────────────────────────────────────────
  const displayed  = conflicts.filter(c =>
    (includeAll ? true : c.status === "ACTIVE") && (!region || c.region === region)
  );
  const activeOnly = displayed.filter(c => c.status === "ACTIVE");
  const withCost   = displayed.map(c => ({ ...c, cost: calcCost(c, now) }));
  const totCost    = withCost.reduce((s, c) => s + c.cost, 0);
  const totRate    = activeOnly.reduce((s, c) => s + c.ratePerDay, 0); // current burn (active only)
  const tFmt       = fmtBig(totCost);
  const hourly     = fmtRate(totRate / 24);
  const daily      = fmtRate(totRate);
  const top4       = [...withCost].sort((a, b) => b.cost - a.cost).slice(0, 4);
  const maxBar     = 340; // px — bar for #1 conflict

  // Earliest conflict start date in set
  const earliest = displayed.reduce((min, c) => c.startDate < min ? c.startDate : min, displayed[0]?.startDate ?? "");
  const sinceStr = earliest
    ? new Date(earliest + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : "";

  // Headline copy
  const headlineCopy = includeAll
    ? (region ? `All tracked conflicts · ${region}` : "Combined cost of all tracked conflicts")
    : (region
        ? `Cost of active ${activeOnly.length === 1 ? "war" : "wars"} · ${region}`
        : "Combined cost of active wars");

  return new ImageResponse((
    <div style={{ display:"flex", flexDirection:"column", width:W, height:H,
                  background:"#080b10", fontFamily:ff, padding:"32px 56px 30px" }}>

      {/* top accent stripe */}
      <div style={{ display:"flex", position:"absolute", top:0, left:0, width:W, height:6, background:"#e74c3c" }} />

      {/* HEADER */}
      <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between",
                    alignItems:"center", marginBottom:20 }}>
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", background:"#e74c3c", color:"#fff",
                        fontSize:12, fontWeight:800, letterSpacing:3, padding:"4px 10px" }}>
            GLOBAL
          </div>
          <div style={{ display:"flex", fontSize:13, fontWeight:700, letterSpacing:3, color:"#4a6070" }}>
            CONFLICT COST TRACKER
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", width:7, height:7, borderRadius:"50%", background:"#e74c3c" }} />
          <div style={{ display:"flex", fontSize:12, letterSpacing:3, color:"#e74c3c" }}>LIVE</div>
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#4d5e6e", marginLeft:10 }}>
            AS OF {asOf}
          </div>
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#3a4a58" }}>·</div>
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#4d5e6e" }}>
            conflictcost.org
          </div>
        </div>
      </div>

      {/* HEADLINE + NUMBER */}
      <div style={{ display:"flex", fontSize:12, letterSpacing:5, color:"#3d4a5a",
                    textTransform:"uppercase", marginBottom:6 }}>
        {headlineCopy}
      </div>
      <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end", gap:6, marginBottom:14 }}>
        <div style={{ display:"flex", fontSize:86, color:"#e74c3c", fontWeight:800, lineHeight:"1" }}>$</div>
        <div style={{ display:"flex", fontSize:86, color:"#f0f4f8", fontWeight:800, lineHeight:"1" }}>{tFmt.val}</div>
        {tFmt.unit ? (
          <div style={{ display:"flex", fontSize:34, color:"#e74c3c", fontWeight:700, paddingBottom:10, marginLeft:6 }}>
            {tFmt.unit}
          </div>
        ) : null}
      </div>

      {/* RATES + CONTEXT */}
      <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:24, marginBottom:18 }}>
        <div style={{ display:"flex", flexDirection:"column", background:"#152535",
                      borderLeft:"4px solid #e74c3c", padding:"10px 20px", gap:4 }}>
          <div style={{ display:"flex", fontSize:38, color:"#f39c12", fontWeight:800 }}>{hourly}</div>
          <div style={{ display:"flex", fontSize:10, letterSpacing:5, color:"#9a7840" }}>{includeAll ? "ACTIVE / HOUR" : "/ HOUR"}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          <div style={{ display:"flex", fontSize:15, color:"#5a6a7c" }}>
            {daily}
            <span style={{ color:"#4a5a6a", marginLeft:8 }}>/ DAY</span>
          </div>
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", fontSize:14, color:"#c8d4e0", fontWeight:800, letterSpacing:1 }}>
              {includeAll
                ? `${displayed.length} CONFLICT${displayed.length !== 1 ? "S" : ""} TRACKED · ${activeOnly.length} ACTIVE${region ? ` · ${region.toUpperCase()}` : ""}`
                : `${activeOnly.length} ACTIVE CONFLICT${activeOnly.length !== 1 ? "S" : ""}${region ? ` · ${region.toUpperCase()}` : " WORLDWIDE"}`}
            </div>
            {sinceStr && (
              <div style={{ display:"flex", fontSize:12, color:"#3d4a5a", letterSpacing:2 }}>
                · SINCE {sinceStr}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div style={{ display:"flex", height:1, background:"#1a2030", marginBottom:14 }} />

      {/* TOP 4 CONFLICTS */}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {top4.map((c) => {
          const pct      = totCost > 0 ? (c.cost / totCost * 100) : 0;
          const barW     = Math.max(6, Math.round((c.cost / top4[0].cost) * maxBar));
          const cFmt     = fmtBig(c.cost);
          const isActive = c.status === "ACTIVE";
          const maxLen   = includeAll && !isActive ? 18 : 22;
          const name     = c.name.length > maxLen ? c.name.slice(0, maxLen) + "…" : c.name;
          const sBadge   = c.status === "CEASEFIRE" ? "CSFR" : c.status === "FROZEN" ? "FRZ" : c.status === "ENDED" ? "END" : null;
          const sColor   = STATUS_COLOR[c.status] || "#4a5568";
          return (
            <div key={c.id} style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:14 }}>
              {/* flag + name + status badge */}
              <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:8, width:230 }}>
                <span style={{ fontSize:18 }}>{c.flag}</span>
                <div style={{ display:"flex", fontSize:13, color:"#7a8fa8", fontWeight:700, letterSpacing:0.5 }}>{name}</div>
                {includeAll && sBadge && (
                  <div style={{ display:"flex", fontSize:8, color:sColor, border:`1px solid ${sColor}`,
                                padding:"1px 4px", letterSpacing:1, opacity:0.9 }}>
                    {sBadge}
                  </div>
                )}
              </div>
              {/* bar */}
              <div style={{ display:"flex", height:5, background:"#0d1520", flex:1 }}>
                <div style={{ display:"flex", height:5, width:barW, background: c.color || "#e74c3c", opacity:0.85 }} />
              </div>
              {/* amount + pct */}
              <div style={{ display:"flex", flexDirection:"row", alignItems:"baseline", gap:7, width:150, justifyContent:"flex-end" }}>
                <div style={{ display:"flex", fontSize:17, color:"#e8edf5", fontWeight:800 }}>
                  ${cFmt.val}{cFmt.unit ? " " + cFmt.unit.slice(0,1).toUpperCase() : ""}
                </div>
                <div style={{ display:"flex", fontSize:11, color:"#3d4a5a", letterSpacing:1 }}>
                  {pct.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", flex:1 }} />

      {/* FOOTER */}
      <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", fontSize:11, color:"#4d5e6e", letterSpacing:1 }}>
          Direct military expenditure — all major parties
        </div>
        <div style={{ display:"flex", fontSize:10, color:"#4d5e6e", letterSpacing:2 }}>
          Source: SIPRI · ACLED · OHCHR · Brown Univ. Costs of War
        </div>
      </div>
    </div>
  ), { width:W, height:H, fonts });
}
