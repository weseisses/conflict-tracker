import { ImageResponse } from "next/og";
import conflictsData from "../../../conflicts.config.json";
import type { Conflict } from "../../../lib/types";

// Node.js runtime — more reliable for external font fetching than edge
export const runtime = "nodejs";

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

// Try multiple font sources — first success wins
async function loadFont(): Promise<ArrayBuffer | null> {
  const sources = [
    // Google Fonts CDN — direct woff2 (Barlow Condensed 700, latin)
    "https://fonts.gstatic.com/s/barlowcondensed/v12/HTxxL3I-JCGChYJ8VI-L6OO_au7B6t7y_3HcuKECcrs.woff2",
    // Inter Bold from rsms.me — well-known fallback used by many OG generators
    "https://rsms.me/inter/font-files/Inter-Bold.woff2",
    // Inter from Google Fonts CDN
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 1000) return buf; // sanity check — real font
      }
    } catch (e) {
      console.error("[og] font source failed:", url, e);
    }
  }

  console.error("[og] all font sources failed — image will be blank");
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get("id");
  const now = new Date();

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "Display", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = "Display, sans-serif";

  const W = 1200, H = 630;

  // ─── SINGLE CONFLICT ────────────────────────────────────────────────────
  const conflict = id ? conflicts.find(c => c.id === id) ?? null : null;

  if (conflict) {
    const cost     = calcCost(conflict, now);
    const costFmt  = fmtBig(cost);
    const hourly   = fmtRate(conflict.ratePerDay / 24);
    const daily    = fmtRate(conflict.ratePerDay);
    const perSec   = fmtRate(conflict.ratePerDay / 86_400);
    const accent   = conflict.color || "#e74c3c";
    const sCl      = STATUS_COLOR[conflict.status] || "#4a5568";
    const startStr = new Date(conflict.startDate + "T00:00:00Z")
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase();

    return new ImageResponse(
      (
        <div style={{ display:"flex", flexDirection:"column", width:W, height:H, background:"#080b10", fontFamily:ff, padding:"48px 60px 44px" }}>

          {/* Top accent stripe */}
          <div style={{ display:"flex", position:"absolute", top:0, left:0, width:W, height:6, background:accent }} />

          {/* HEADER */}
          <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
            <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:14 }}>
              <div style={{ display:"flex", background:"#e74c3c", color:"#fff", fontSize:13, fontWeight:800, letterSpacing:3, padding:"4px 12px" }}>
                GLOBAL
              </div>
              <div style={{ display:"flex", fontSize:16, fontWeight:700, letterSpacing:3, color:"#7a8fa8" }}>
                CONFLICT COST TRACKER
              </div>
            </div>
            <div style={{ display:"flex", fontSize:14, letterSpacing:3, color:"#2d3a4a" }}>
              conflictcost.org
            </div>
          </div>

          {/* CONFLICT NAME */}
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:20, marginBottom:20 }}>
            <span style={{ fontSize:58 }}>{conflict.flag}</span>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ display:"flex", fontSize:34, fontWeight:800, color:"#e8edf5", letterSpacing:1 }}>
                {conflict.name.toUpperCase()}
              </div>
              <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:18 }}>
                <div style={{ display:"flex", fontSize:13, letterSpacing:3, color:"#3d4a5a" }}>SINCE {startStr}</div>
                <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:7 }}>
                  <div style={{ display:"flex", width:7, height:7, borderRadius:"50%", background:sCl }} />
                  <div style={{ display:"flex", fontSize:13, letterSpacing:3, color:sCl }}>{conflict.status}</div>
                </div>
              </div>
            </div>
          </div>

          {/* BIG COST */}
          <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end", gap:6, marginBottom:24 }}>
            <span style={{ display:"flex", fontSize:90, color:accent, fontWeight:800, lineHeight:"1" }}>$</span>
            <span style={{ display:"flex", fontSize:90, color:"#f0f4f8", fontWeight:800, lineHeight:"1" }}>{costFmt.val}</span>
            {costFmt.unit ? (
              <span style={{ display:"flex", fontSize:38, color:accent, fontWeight:700, paddingBottom:14, marginLeft:8 }}>
                {costFmt.unit}
              </span>
            ) : null}
          </div>

          {/* RATES — /hour is hero */}
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:32 }}>
            <div style={{ display:"flex", flexDirection:"column", background:"#0d1520", borderLeft:`4px solid ${accent}`, padding:"12px 24px", gap:6 }}>
              <div style={{ display:"flex", fontSize:46, color:"#f39c12", fontWeight:800 }}>{hourly}</div>
              <div style={{ display:"flex", fontSize:12, letterSpacing:5, color:"#7a6030" }}>/ HOUR</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", fontSize:18, color:"#3a4a5a" }}>{daily}&nbsp;&nbsp;<span style={{ color:"#2a3a4a" }}>/ DAY</span></div>
              <div style={{ display:"flex", fontSize:18, color:"#3a4a5a" }}>{perSec}&nbsp;&nbsp;<span style={{ color:"#2a3a4a" }}>/ SEC</span></div>
            </div>
          </div>

          {/* SPACER */}
          <div style={{ display:"flex", flex:1 }} />

          {/* FOOTER */}
          <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" }}>
            <div style={{ display:"flex", fontSize:14, color:"#2d3a4a", letterSpacing:1 }}>{conflict.parties}</div>
            <div style={{ display:"flex", fontSize:12, color:"#1e2838", letterSpacing:2 }}>SIPRI · ACLED · OHCHR</div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    );
  }

  // ─── GLOBAL / ALL ACTIVE ─────────────────────────────────────────────────
  const active    = conflicts.filter(c => c.status === "ACTIVE");
  const totalCost = active.reduce((s, c) => s + calcCost(c, now), 0);
  const totalRate = active.reduce((s, c) => s + c.ratePerDay, 0);
  const totFmt    = fmtBig(totalCost);
  const hourly    = fmtRate(totalRate / 24);
  const daily     = fmtRate(totalRate);

  return new ImageResponse(
    (
      <div style={{ display:"flex", flexDirection:"column", width:W, height:H, background:"#080b10", fontFamily:ff, padding:"48px 60px 44px" }}>

        {/* Top accent stripe */}
        <div style={{ display:"flex", position:"absolute", top:0, left:0, width:W, height:6, background:"#e74c3c" }} />

        {/* HEADER */}
        <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
          <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", background:"#e74c3c", color:"#fff", fontSize:13, fontWeight:800, letterSpacing:3, padding:"4px 12px" }}>
              GLOBAL
            </div>
            <div style={{ display:"flex", fontSize:16, fontWeight:700, letterSpacing:3, color:"#7a8fa8" }}>
              CONFLICT COST TRACKER
            </div>
          </div>
          <div style={{ display:"flex", fontSize:14, letterSpacing:3, color:"#2d3a4a" }}>
            conflictcost.org
          </div>
        </div>

        {/* TITLE */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:20, marginBottom:20 }}>
          <span style={{ fontSize:58 }}>🌐</span>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", fontSize:34, fontWeight:800, color:"#e8edf5", letterSpacing:1 }}>
              {active.length} ACTIVE CONFLICTS WORLDWIDE
            </div>
            <div style={{ display:"flex", fontSize:13, letterSpacing:3, color:"#3d4a5a" }}>
              COMBINED MILITARY EXPENDITURE · LIVE ESTIMATE
            </div>
          </div>
        </div>

        {/* BIG COST */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end", gap:6, marginBottom:24 }}>
          <span style={{ display:"flex", fontSize:90, color:"#e74c3c", fontWeight:800, lineHeight:"1" }}>$</span>
          <span style={{ display:"flex", fontSize:90, color:"#f0f4f8", fontWeight:800, lineHeight:"1" }}>{totFmt.val}</span>
          {totFmt.unit ? (
            <span style={{ display:"flex", fontSize:38, color:"#e74c3c", fontWeight:700, paddingBottom:14, marginLeft:8 }}>
              {totFmt.unit}
            </span>
          ) : null}
        </div>

        {/* RATES */}
        <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:32 }}>
          <div style={{ display:"flex", flexDirection:"column", background:"#0d1520", borderLeft:"4px solid #e74c3c", padding:"12px 24px", gap:6 }}>
            <div style={{ display:"flex", fontSize:46, color:"#f39c12", fontWeight:800 }}>{hourly}</div>
            <div style={{ display:"flex", fontSize:12, letterSpacing:5, color:"#7a6030" }}>/ HOUR</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", fontSize:18, color:"#3a4a5a" }}>{daily}&nbsp;&nbsp;<span style={{ color:"#2a3a4a" }}>/ DAY</span></div>
            <div style={{ display:"flex", fontSize:18, color:"#3a4a5a" }}>AND COUNTING</div>
          </div>
        </div>

        {/* SPACER */}
        <div style={{ display:"flex", flex:1 }} />

        {/* FOOTER */}
        <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div style={{ display:"flex", fontSize:14, color:"#2d3a4a", letterSpacing:1 }}>
            Live estimates based on direct military expenditure
          </div>
          <div style={{ display:"flex", fontSize:12, color:"#1e2838", letterSpacing:2 }}>SIPRI · ACLED · OHCHR</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
