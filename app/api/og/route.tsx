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

function isWoff(buf: ArrayBuffer): boolean {
  // wOFF = 0x774F4646, wOF2 = 0x774F4632 — Satori rejects both
  const sig = new DataView(buf).getUint32(0, false);
  return sig === 0x774F4646 || sig === 0x774F4632;
}

async function tryFetch(url: string, ms = 8000): Promise<ArrayBuffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null;
    if (isWoff(buf)) return null; // reject woff/woff2 — Satori needs TTF/OTF
    return buf;
  } catch { return null; }
}

async function loadFont(): Promise<ArrayBuffer | null> {
  // Satori ONLY supports OTF/TTF — not woff/woff2.
  // Try Google Fonts CSS with legacy UA (should return TTF), then static CDN fallbacks.

  // 1. Google Fonts → legacy CSS → extract TTF URL
  for (const family of ["Barlow+Condensed:wght@700", "Inter:wght@700"]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const cssRes = await fetch(
        `https://fonts.googleapis.com/css2?family=${family}`,
        {
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" },
        }
      );
      clearTimeout(t);
      if (!cssRes.ok) continue;
      const css = await cssRes.text();
      const m = css.match(/url\(['"]?([^'")\s]+\.ttf)['"]?\)/i);
      if (!m) continue;
      const buf = await tryFetch(m[1]);
      if (buf) return buf;
    } catch { /* next */ }
  }

  // 2. Known stable TTF URLs from Google Fonts static CDN
  const ttfUrls = [
    // Inter Bold Latin
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.ttf",
    // Barlow Condensed Bold Latin
    "https://fonts.gstatic.com/s/barlowcondensed/v12/HTxxL3I-JCGChYJ8VI-L6OO_au7B6t7y_3HcuKECcrs.ttf",
    // Roboto Condensed Bold — reliable fallback
    "https://fonts.gstatic.com/s/robotocondensed/v25/ieVi2ZhZI2eCN5jzbjEETS9weq8-19eDpCEYat9hmD0.ttf",
  ];
  for (const url of ttfUrls) {
    const buf = await tryFetch(url);
    if (buf) return buf;
  }

  return null; // Satori will use built-in Noto Sans
}

const W = 1200, H = 630;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get("id");
  const now = new Date();

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "F", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "F, sans-serif" : "sans-serif";

  const conflict = id ? conflicts.find(c => c.id === id) ?? null : null;

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
          <div style={{ display:"flex", fontSize:13, letterSpacing:3, color:"#2d3a4a" }}>
            conflictcost.org
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

  // ─── GLOBAL ───────────────────────────────────────────────────────────────
  const active    = conflicts.filter(c => c.status === "ACTIVE");
  const totCost   = active.reduce((s, c) => s + calcCost(c, now), 0);
  const totRate   = active.reduce((s, c) => s + c.ratePerDay, 0);
  const tFmt      = fmtBig(totCost);
  const hourly    = fmtRate(totRate / 24);
  const daily     = fmtRate(totRate);

  return new ImageResponse((
    <div style={{ display:"flex", flexDirection:"column", width:W, height:H,
                  background:"#080b10", fontFamily:ff, padding:"48px 60px 44px" }}>

      <div style={{ display:"flex", position:"absolute", top:0, left:0,
                    width:W, height:6, background:"#e74c3c" }} />

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
        <div style={{ display:"flex", fontSize:13, letterSpacing:3, color:"#2d3a4a" }}>
          conflictcost.org
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:18, marginBottom:18 }}>
        <span style={{ fontSize:54 }}>🌐</span>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", fontSize:32, fontWeight:800, color:"#e8edf5", letterSpacing:1 }}>
            {active.length} ACTIVE CONFLICTS WORLDWIDE
          </div>
          <div style={{ display:"flex", fontSize:12, letterSpacing:3, color:"#3d4a5a" }}>
            COMBINED MILITARY EXPENDITURE · LIVE ESTIMATE
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"row", alignItems:"flex-end",
                    gap:4, marginBottom:22 }}>
        <span style={{ display:"flex", fontSize:92, color:"#e74c3c", fontWeight:800, lineHeight:"1" }}>$</span>
        <span style={{ display:"flex", fontSize:92, color:"#f0f4f8", fontWeight:800, lineHeight:"1" }}>
          {tFmt.val}
        </span>
        {tFmt.unit ? (
          <span style={{ display:"flex", fontSize:38, color:"#e74c3c", fontWeight:700,
                         paddingBottom:12, marginLeft:8 }}>
            {tFmt.unit}
          </span>
        ) : null}
      </div>

      <div style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:28 }}>
        <div style={{ display:"flex", flexDirection:"column",
                      background:"#0d1520", borderLeft:"4px solid #e74c3c",
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
            {daily}<span style={{ color:"#2a3a4a", marginLeft:8 }}>/ DAY</span>
          </div>
          <div style={{ display:"flex", fontSize:17, color:"#3a4a5a" }}>
            AND COUNTING
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flex:1 }} />

      <div style={{ display:"flex", flexDirection:"row", justifyContent:"space-between",
                    alignItems:"center" }}>
        <div style={{ display:"flex", fontSize:13, color:"#2d3a4a", letterSpacing:1 }}>
          Live estimates based on direct military expenditure
        </div>
        <div style={{ display:"flex", fontSize:11, color:"#1e2838", letterSpacing:2 }}>
          SIPRI · ACLED · OHCHR
        </div>
      </div>
    </div>
  ), { width:W, height:H, fonts });
}
