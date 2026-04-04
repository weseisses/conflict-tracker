import { ImageResponse } from "next/og";
import conflictsData from "../../../conflicts.config.json";
import type { Conflict } from "../../../lib/types";

export const runtime = "edge";

const conflicts = conflictsData as Conflict[];

// Inline cost helpers (avoids any Node import issues at edge)
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
  if (n >= 1e9)  return { val: (n / 1e9).toFixed(3),  unit: "BILLION" };
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get("id");
  const now = new Date();

  // — Font —
  let fontData: ArrayBuffer | null = null;
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; OGBot/1.0)" } }
    );
    const css      = await cssRes.text();
    const fontUrl  = css.match(/url\(([^)]+)\)/)?.[1];
    if (fontUrl) fontData = await fetch(fontUrl).then(r => r.arrayBuffer());
  } catch { /* fall back to system sans-serif */ }

  const fonts = fontData
    ? [{ name: "Barlow", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "Barlow, sans-serif" : "sans-serif";

  // ─── SINGLE CONFLICT ─────────────────────────────────────────────────────
  const conflict = id ? conflicts.find(c => c.id === id) ?? null : null;

  if (conflict) {
    const cost      = calcCost(conflict, now);
    const costFmt   = fmtBig(cost);
    const hourly    = fmtRate(conflict.ratePerDay / 24);
    const daily     = fmtRate(conflict.ratePerDay);
    const perSec    = fmtRate(conflict.ratePerDay / 86_400);
    const accent    = conflict.color || "#e74c3c";
    const sCl       = STATUS_COLOR[conflict.status] || "#4a5568";
    const startStr  = new Date(conflict.startDate + "T00:00:00Z")
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .toUpperCase();

    return new ImageResponse(
      (
        <div style={{ display:"flex", flexDirection:"column", width:"100%", height:"100%",
                      background:"#080b10", fontFamily: ff, padding:"48px 60px", position:"relative" }}>

          {/* Top accent stripe */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:6, background:accent, display:"flex" }} />

          {/* Subtle left glow line */}
          <div style={{ position:"absolute", top:6, bottom:0, left:0, width:3,
                        background:`linear-gradient(to bottom, ${accent}88, transparent)`, display:"flex" }} />

          {/* HEADER */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ background:"#e74c3c", color:"#fff", fontSize:13, fontWeight:800,
                            letterSpacing:3, padding:"4px 12px", display:"flex" }}>GLOBAL</div>
              <div style={{ fontSize:16, fontWeight:700, letterSpacing:3, color:"#7a8fa8" }}>
                CONFLICT COST TRACKER
              </div>
            </div>
            <div style={{ fontSize:14, letterSpacing:3, color:"#2d3a4a", display:"flex" }}>
              conflictcost.org
            </div>
          </div>

          {/* CONFLICT NAME + META */}
          <div style={{ display:"flex", alignItems:"center", gap:22, marginBottom:22 }}>
            <span style={{ fontSize:60 }}>{conflict.flag}</span>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:36, fontWeight:800, color:"#e8edf5", letterSpacing:1, lineHeight:1 }}>
                {conflict.name.toUpperCase()}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:18 }}>
                <div style={{ fontSize:13, letterSpacing:3, color:"#3d4a5a" }}>
                  SINCE {startStr}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:sCl, display:"flex" }} />
                  <div style={{ fontSize:13, letterSpacing:3, color:sCl }}>{conflict.status}</div>
                </div>
              </div>
            </div>
          </div>

          {/* BIG COST */}
          <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:26, lineHeight:1 }}>
            <span style={{ fontSize:94, color:accent, fontWeight:800 }}>$</span>
            <span style={{ fontSize:94, color:"#f0f4f8", fontWeight:800 }}>{costFmt.val}</span>
            {costFmt.unit && (
              <span style={{ fontSize:40, color:accent, fontWeight:700,
                             alignSelf:"flex-end", marginBottom:14, marginLeft:10 }}>
                {costFmt.unit}
              </span>
            )}
          </div>

          {/* RATES — /hour is the hero */}
          <div style={{ display:"flex", alignItems:"center", gap:36 }}>
            <div style={{ display:"flex", flexDirection:"column",
                          background:"#0d1520", border:`1px solid ${accent}44`,
                          padding:"14px 28px" }}>
              <div style={{ fontSize:48, color:"#f39c12", fontWeight:800, lineHeight:1 }}>{hourly}</div>
              <div style={{ fontSize:12, letterSpacing:5, color:"#7a6030", marginTop:7 }}>/ HOUR</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ fontSize:19, color:"#3a4a5a", letterSpacing:1 }}>{daily} <span style={{ color:"#2d3a4a" }}>/ DAY</span></div>
              <div style={{ fontSize:19, color:"#3a4a5a", letterSpacing:1 }}>{perSec} <span style={{ color:"#2d3a4a" }}>/ SEC</span></div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:"auto" }}>
            <div style={{ fontSize:15, color:"#2d3a4a", letterSpacing:1 }}>{conflict.parties}</div>
            <div style={{ fontSize:12, color:"#1e2838", letterSpacing:2 }}>SIPRI · ACLED · OHCHR</div>
          </div>
        </div>
      ),
      { width:1200, height:630, fonts }
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
      <div style={{ display:"flex", flexDirection:"column", width:"100%", height:"100%",
                    background:"#080b10", fontFamily: ff, padding:"48px 60px", position:"relative" }}>

        {/* Top accent stripe */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:6, background:"#e74c3c", display:"flex" }} />

        {/* HEADER */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ background:"#e74c3c", color:"#fff", fontSize:13, fontWeight:800,
                          letterSpacing:3, padding:"4px 12px", display:"flex" }}>GLOBAL</div>
            <div style={{ fontSize:16, fontWeight:700, letterSpacing:3, color:"#7a8fa8" }}>
              CONFLICT COST TRACKER
            </div>
          </div>
          <div style={{ fontSize:14, letterSpacing:3, color:"#2d3a4a", display:"flex" }}>
            conflictcost.org
          </div>
        </div>

        {/* TITLE */}
        <div style={{ display:"flex", alignItems:"center", gap:22, marginBottom:22 }}>
          <span style={{ fontSize:58 }}>🌐</span>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:36, fontWeight:800, color:"#e8edf5", letterSpacing:1, lineHeight:1 }}>
              {active.length} ACTIVE CONFLICTS WORLDWIDE
            </div>
            <div style={{ fontSize:13, letterSpacing:3, color:"#3d4a5a" }}>
              COMBINED MILITARY EXPENDITURE · LIVE ESTIMATE
            </div>
          </div>
        </div>

        {/* BIG COST */}
        <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:26, lineHeight:1 }}>
          <span style={{ fontSize:94, color:"#e74c3c", fontWeight:800 }}>$</span>
          <span style={{ fontSize:94, color:"#f0f4f8", fontWeight:800 }}>{totFmt.val}</span>
          {totFmt.unit && (
            <span style={{ fontSize:40, color:"#e74c3c", fontWeight:700,
                           alignSelf:"flex-end", marginBottom:14, marginLeft:10 }}>
              {totFmt.unit}
            </span>
          )}
        </div>

        {/* RATES */}
        <div style={{ display:"flex", alignItems:"center", gap:36 }}>
          <div style={{ display:"flex", flexDirection:"column",
                        background:"#0d1520", border:"1px solid #e74c3c44",
                        padding:"14px 28px" }}>
            <div style={{ fontSize:48, color:"#f39c12", fontWeight:800, lineHeight:1 }}>{hourly}</div>
            <div style={{ fontSize:12, letterSpacing:5, color:"#7a6030", marginTop:7 }}>/ HOUR</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:19, color:"#3a4a5a", letterSpacing:1 }}>{daily} <span style={{ color:"#2d3a4a" }}>/ DAY</span></div>
            <div style={{ fontSize:19, color:"#3a4a5a", letterSpacing:1 }}>AND COUNTING</div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:"auto" }}>
          <div style={{ fontSize:15, color:"#2d3a4a", letterSpacing:1 }}>
            Live estimates based on direct military expenditure
          </div>
          <div style={{ fontSize:12, color:"#1e2838", letterSpacing:2 }}>SIPRI · ACLED · OHCHR</div>
        </div>
      </div>
    ),
    { width:1200, height:630, fonts }
  );
}
