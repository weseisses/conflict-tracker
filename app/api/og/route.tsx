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

  const region   = searchParams.get("region"); // e.g. "Europe", "Middle East"
  const conflict = id ? conflicts.find(c => c.id === id) ?? null : null;
  const asOf = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

  // ─── SINGLE CONFLICT ─────────────────────────────────────────────────────
  if (conflict) {
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

    return new ImageResponse((
      <div style={{ display:"flex", flexDirection:"column", width:W, height:H,
                    background:"#080b10", fontFamily:ff, padding:"48px 60px 44px" }}>

        {/* accent stripe */}
        <div style={{ display:"flex", position:"absolute", top:0, left:0,
                      width:W, height:6, background:accent }} />

        {/* HEADER */}
        <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between",
                      alignItems:"center", marginBottom:28 }}>
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", background:"#e74c3c", color:"#fff",
                          fontSize:13, fontWeight:800, letterSpacing:3, padding:"4px 12px" }}>
              GLOBAL
            </div>
            <div style={{ display:"flex", fontSize:15, fontWeight:700, letterSpacing:3, color:"#7a8fa8" }}>
              CONFLICT COST TRACKER
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#2d3a4a" }}>AS OF {asOf}</div>
            <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#1e2838" }}>·</div>
            <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#2d3a4a" }}>conflictcost.org</div>
          </div>
        </div>

        {/* NAME */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:18, marginBottom:18 }}>
          <span style={{ fontSize:56 }}>{conflict.flag}</span>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", fontSize:32, fontWeight:800, color:"#e8edf5", letterSpacing:1 }}>
              {conflict.name.toUpperCase()}
            </div>
            <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:16 }}>
              <div style={{ display:"flex", fontSize:12, letterSpacing:3, color:"#3d4a5a" }}>
                SINCE {started}
              </div>
              <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:6 }}>
                <div style={{ display:"flex", width:7, height:7, borderRadius:"50%",
                              background:sCl }} />
                <div style={{ display:"flex", fontSize:12, letterSpacing:3, color:sCl }}>
                  {conflict.status}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BIG COST */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end",
                      gap:4, marginBottom:22 }}>
          <span style={{ display:"flex", fontSize:92, color:accent, fontWeight:800, lineHeight:"1" }}>$</span>
          <span style={{ display:"flex", fontSize:92, color:"#f0f4f8", fontWeight:800, lineHeight:"1" }}>
            {cFmt.val}
          </span>
          {cFmt.unit ? (
            <span style={{ display:"flex", fontSize:38, color:accent, fontWeight:700,
                           paddingBottom:12, marginLeft:8 }}>
              {cFmt.unit}
            </span>
          ) : null}
        </div>

        {/* RATES */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:28 }}>
          <div style={{ display:"flex", flexDirection:"column",
                        background:"#0d1520", borderLeft:`4px solid ${accent}`,
                        padding:"12px 22px", gap:6 }}>
            <div style={{ display:"flex", fontSize:44, color:"#f39c12", fontWeight:800 }}>
              {hourly}
            </div>
            <div style={{ display:"flex", fontSize:11, letterSpacing:5, color:"#7a6030" }}>
              / HOUR
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", fontSize:17, color:"#3a4a5a" }}>
              {daily}
              <span style={{ color:"#2a3a4a", marginLeft:8 }}>/ DAY</span>
            </div>
            <div style={{ display:"flex", fontSize:17, color:"#3a4a5a" }}>
              {perSec}
              <span style={{ color:"#2a3a4a", marginLeft:8 }}>/ SEC</span>
            </div>
          </div>
        </div>

        {/* spacer */}
        <div style={{ display:"flex", flex:1 }} />

        {/* FOOTER */}
        <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between",
                      alignItems:"center" }}>
          <div style={{ display:"flex", fontSize:13, color:"#2d3a4a", letterSpacing:1 }}>
            {conflict.parties}
          </div>
          <div style={{ display:"flex", fontSize:11, color:"#1e2838", letterSpacing:2 }}>
            SIPRI · ACLED · OHCHR
          </div>
        </div>
      </div>
    ), { width:W, height:H, fonts });
  }

  // ─── GLOBAL / REGIONAL ────────────────────────────────────────────────────
  const active   = conflicts.filter(c =>
    c.status === "ACTIVE" && (!region || c.region === region)
  );
  const withCost = active.map(c => ({ ...c, cost: calcCost(c, now) }));
  const totCost  = withCost.reduce((s, c) => s + c.cost, 0);
  const totRate  = active.reduce((s, c) => s + c.ratePerDay, 0);
  const tFmt     = fmtBig(totCost);
  const hourly   = fmtRate(totRate / 24);
  const daily    = fmtRate(totRate);
  const top4     = [...withCost].sort((a, b) => b.cost - a.cost).slice(0, 4);
  const maxBar   = 340; // px — bar for #1 conflict

  // Earliest active conflict start date
  const earliest = active.reduce((min, c) => c.startDate < min ? c.startDate : min, active[0]?.startDate ?? "");
  const sinceStr = earliest
    ? new Date(earliest + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : "";

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
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#2d3a4a", marginLeft:10 }}>
            AS OF {asOf}
          </div>
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#1e2838" }}>·</div>
          <div style={{ display:"flex", fontSize:11, letterSpacing:2, color:"#2d3a4a" }}>
            conflictcost.org
          </div>
        </div>
      </div>

      {/* HEADLINE + NUMBER */}
      <div style={{ display:"flex", fontSize:12, letterSpacing:5, color:"#3d4a5a",
                    textTransform:"uppercase", marginBottom:6 }}>
        {region ? `Cost of active war · ${region}` : "Combined cost of active war"}
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
        <div style={{ display:"flex", flexDirection:"column", background:"#0d1520",
                      borderLeft:"4px solid #e74c3c", padding:"10px 20px", gap:4 }}>
          <div style={{ display:"flex", fontSize:38, color:"#f39c12", fontWeight:800 }}>{hourly}</div>
          <div style={{ display:"flex", fontSize:10, letterSpacing:5, color:"#7a6030" }}>/ HOUR</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          <div style={{ display:"flex", fontSize:15, color:"#3a4a5a" }}>
            {daily}
            <span style={{ color:"#2a3a4a", marginLeft:8 }}>/ DAY</span>
          </div>
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", fontSize:14, color:"#c8d4e0", fontWeight:800, letterSpacing:1 }}>
              {active.length} ACTIVE CONFLICT{active.length !== 1 ? "S" : ""}{region ? ` · ${region.toUpperCase()}` : " WORLDWIDE"}
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
          const pct    = totCost > 0 ? (c.cost / totCost * 100) : 0;
          const barW   = Math.max(6, Math.round((c.cost / top4[0].cost) * maxBar));
          const cFmt   = fmtBig(c.cost);
          const name   = c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name;
          return (
            <div key={c.id} style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:14 }}>
              {/* flag + name */}
              <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:8, width:230 }}>
                <span style={{ fontSize:18 }}>{c.flag}</span>
                <div style={{ display:"flex", fontSize:12, color:"#7a8fa8", fontWeight:700, letterSpacing:0.5 }}>{name}</div>
              </div>
              {/* bar */}
              <div style={{ display:"flex", height:5, background:"#0d1520", flex:1 }}>
                <div style={{ display:"flex", height:5, width:barW, background: c.color || "#e74c3c", opacity:0.85 }} />
              </div>
              {/* amount + pct */}
              <div style={{ display:"flex", flexDirection:"row", alignItems:"baseline", gap:7, width:150, justifyContent:"flex-end" }}>
                <div style={{ display:"flex", fontSize:15, color:"#e8edf5", fontWeight:800 }}>
                  ${cFmt.val}{cFmt.unit ? " " + cFmt.unit.slice(0,1).toUpperCase() : ""}
                </div>
                <div style={{ display:"flex", fontSize:10, color:"#3d4a5a", letterSpacing:1 }}>
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
        <div style={{ display:"flex", fontSize:11, color:"#2d3a4a", letterSpacing:1 }}>
          Direct military expenditure — all major parties
        </div>
        <div style={{ display:"flex", fontSize:10, color:"#2d3a4a", letterSpacing:2 }}>
          Source: SIPRI · ACLED · OHCHR · Brown Univ. Costs of War
        </div>
      </div>
    </div>
  ), { width:W, height:H, fonts });
}
