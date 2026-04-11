"use client";

import { useRef, useState, useCallback } from "react";
import type { Conflict, SpendChartConfig, SpendParty, RatePoint } from "../lib/types";

const SITE = "https://conflictcost.org";

// ─── SVG coordinate constants ─────────────────────────────────────────────────
const VB_W = 800;
const VB_H = 200;
const PAD  = { t: 12, r: 20, b: 34, l: 56 };
const CW   = VB_W - PAD.l - PAD.r;
const CH   = VB_H - PAD.t - PAD.b;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function fmtB(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `$${v.toFixed(0)}B`;
  return `$${(v * 1000).toFixed(0)}M`;
}

function toX(i: number, total: number): number {
  return PAD.l + (i / (total - 1)) * CW;
}
function toY(v: number, maxB: number): number {
  return PAD.t + CH - (v / maxB) * CH;
}
function buildPath(series: number[], maxB: number): string {
  return series
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i, series.length).toFixed(1)},${toY(v, maxB).toFixed(1)}`)
    .join(" ");
}
function buildArea(series: number[], maxB: number): string {
  const bot = PAD.t + CH;
  const n   = series.length;
  return (
    `M${toX(0, n).toFixed(1)},${bot} ` +
    series.map((v, i) => `L${toX(i, n).toFixed(1)},${toY(v, maxB).toFixed(1)}`).join(" ") +
    ` L${toX(n - 1, n).toFixed(1)},${bot} Z`
  );
}

// ─── Rate / cumulative maths ──────────────────────────────────────────────────
/**
 * Returns the cumulative spend (USD billions) at `targetTs`,
 * integrating a step-function defined by `rateHistory`.
 * `partyKey` selects a specific party from `rp.rates`; absent = use `rp.rate`.
 */
function getCumAt(
  targetTs:    number,
  startTs:     number,
  rateHistory: RatePoint[],
  defaultRate: number,   // USD/day — used before first rateHistory entry
  partyKey?:   string,
): number {
  if (targetTs <= startTs) return 0;

  const sorted = [...rateHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let cum  = 0;
  let prev = startTs;
  let rate = partyKey ? 0 : defaultRate;

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

/** Build 80 evenly-spaced points; returns combined series + per-party series. */
function buildSeries(
  conflict: Conflict,
  chart:    SpendChartConfig,
  now:      Date,
): {
  timestamps: number[];
  combined:   number[];
  parties:    Record<string, number[]>;
} {
  const startTs = new Date(conflict.startDate + "T00:00:00Z").getTime();
  const endTs   = conflict.endDate
    ? new Date(conflict.endDate + "T00:00:00Z").getTime()
    : now.getTime();

  const N  = 80;
  const ts = Array.from({ length: N }, (_, i) => startTs + (i / (N - 1)) * (endTs - startTs));

  const rh = chart.rateHistory ?? [];

  // Single-line or no history: straight line using conflict.ratePerDay + anchor
  if (chart.mode === "single" || rh.length === 0) {
    const combined = ts.map((t) =>
      rh.length > 0
        ? getCumAt(t, startTs, rh, conflict.ratePerDay)
        : conflict.anchor / 1e9 + ((t - startTs) / DAY_MS) * (conflict.ratePerDay / 1e9),
    );
    return { timestamps: ts, combined, parties: {} };
  }

  // Multi-line: one series per party that has data
  const combined = ts.map((t) => getCumAt(t, startTs, rh, conflict.ratePerDay));
  const parties: Record<string, number[]> = {};
  for (const p of chart.parties) {
    if (p.confidence !== "none") {
      parties[p.key] = ts.map((t) => getCumAt(t, startTs, rh, 0, p.key));
    }
  }
  return { timestamps: ts, combined, parties };
}

// ─── Axis helpers ─────────────────────────────────────────────────────────────
function yTicks(maxB: number): number[] {
  const STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 750, 1000, 1500];
  const step  = STEPS.find((s) => maxB / s >= 3 && maxB / s <= 7) ??
                STEPS.find((s) => maxB / s <= 7) ?? 500;
  const out: number[] = [0];
  for (let v = step; v <= maxB * 1.05; v += step) out.push(v);
  return out;
}

function xLabels(ts: number[]): { idx: number; label: string }[] {
  const spanDays = (ts[ts.length - 1] - ts[0]) / DAY_MS;
  const out: { idx: number; label: string }[] = [];
  let lastKey = -1;

  ts.forEach((t, i) => {
    const d = new Date(t);
    const key = spanDays > 365 ? d.getUTCFullYear() : d.getUTCMonth();
    if (key !== lastKey) {
      lastKey = key;
      out.push({
        idx: i,
        label: spanDays > 365
          ? String(d.getUTCFullYear())
          : d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      });
    }
  });
  return out;
}

// ─── Confidence pill styles ───────────────────────────────────────────────────
const CS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: "SOURCED",     color: "#4ade80", bg: "#052e16", border: "#166534" },
  medium: { label: "ESTIMATED",   color: "#fbbf24", bg: "#422006", border: "#92400e" },
  none:   { label: "UNDISCLOSED", color: "#4b5563", bg: "#111827", border: "#1f2937" },
};

// ─── Party card ───────────────────────────────────────────────────────────────
function PartyCard({ p, isLast }: { p: SpendParty; isLast: boolean }) {
  const cs = CS[p.confidence];
  const figure = p.estimate
    ? fmtB(p.estimate.mid)
    : "—";
  const figureColor = p.confidence === "none" || !p.estimate
    ? "#374151"
    : p.color;

  return (
    <div style={{
      padding: "12px 14px",
      borderRight: isLast ? "none" : "1px solid #1a2030",
      borderTop: `2px solid ${p.confidence === "none" ? "#1f2937" : p.color}`,
      opacity: p.confidence === "none" ? 0.65 : 1,
    }}>
      {/* Title row: name · figure · qualifier pill */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.3 }}>
          {p.name}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: figureColor, fontVariantNumeric: "tabular-nums" }}>
          {figure}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 1,
          padding: "2px 5px", borderRadius: 2,
          background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color,
          whiteSpace: "nowrap",
        }}>
          {cs.label}
        </span>
      </div>

      {/* Explainer */}
      <div style={{ fontSize: 11, color: "#4a5568", lineHeight: 1.65 }}>
        {p.explainer}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SpendChartPanel({
  conflict,
  chart,
}: {
  conflict: Conflict;
  chart:    SpendChartConfig;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const [hov, setHov]           = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [imgCopied, setImgCopied] = useState(false);
  const now       = new Date();

  const { timestamps, combined, parties } = buildSeries(conflict, chart, now);
  const activePts = chart.mode === "multi"
    ? chart.parties.filter((p) => p.confidence !== "none" && parties[p.key])
    : [];

  const maxB  = Math.max(...combined, ...Object.values(parties).flat()) * 1.08;
  const ticks = yTicks(maxB);
  const xlabs = xLabels(timestamps);
  const N     = timestamps.length;

  // Mouse handling — convert screen x → nearest data index
  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width - PAD.l / VB_W) / (CW / VB_W);
    setHov(Math.round(Math.max(0, Math.min(1, pct)) * (N - 1)));
  }, [N]);

  // Tooltip positioning: flip left when past midpoint
  const tipLeft  = hov !== null && hov < N * 0.55;
  const tipXPct  = hov !== null ? ((toX(hov, N) / VB_W) * 100).toFixed(1) + "%" : "0%";

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Section header — matches DetailPanel style */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 3,
        textTransform: "uppercase", color: conflict.color, marginBottom: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>Spend Over Time</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 9, color: "#2d3a4a", fontWeight: 400, letterSpacing: 1, textTransform: "none" }}>
            {chart.mode === "multi" ? "expenditure by party" : "combined · all parties"}
            {chart.note ? ` · ${chart.note}` : ""}
          </span>
          <button
            onClick={() => setShareOpen(true)}
            style={{
              background: "transparent", border: "1px solid #1e2a38",
              color: "#3d4a5a", fontSize: 9, fontWeight: 700,
              letterSpacing: 1.5, padding: "3px 8px", cursor: "pointer",
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}
          >
            ↗ Share Chart
          </button>
        </div>
      </div>

      {/* Outer border — chart + cards share one border */}
      <div style={{ background: "#0c0f14", border: "1px solid #1a2030" }}>

        {/* ── SVG Chart ── */}
        <div style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            style={{ display: "block", cursor: "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHov(null)}
          >
            <defs>
              {/* Area gradient — single mode uses conflict colour */}
              {chart.mode === "single" && (
                <linearGradient id="sg_single" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={conflict.color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={conflict.color} stopOpacity={0.01} />
                </linearGradient>
              )}
              {/* Per-party gradients */}
              {activePts.map((p) => (
                <linearGradient key={p.key} id={`sg_${p.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={p.color} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={p.color} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal grid */}
            {ticks.map((t) => (
              <line
                key={t}
                x1={PAD.l} y1={toY(t, maxB)}
                x2={PAD.l + CW} y2={toY(t, maxB)}
                stroke="#1a2030" strokeWidth={1}
              />
            ))}

            {/* Y labels */}
            {ticks.map((t) => (
              <text key={t} x={PAD.l - 6} y={toY(t, maxB) + 4}
                textAnchor="end" fontSize={10} fill="#374151" fontFamily="monospace">
                {fmtB(t)}
              </text>
            ))}

            {/* X labels */}
            {xlabs.map(({ idx, label }) => (
              <text key={idx} x={toX(idx, N)} y={VB_H - 6}
                textAnchor="middle" fontSize={9} fill="#374151" fontFamily="monospace">
                {label}
              </text>
            ))}

            {/* Area fills */}
            {chart.mode === "single" && (
              <path d={buildArea(combined, maxB)} fill="url(#sg_single)" />
            )}
            {activePts.map((p) => (
              <path key={p.key} d={buildArea(parties[p.key], maxB)} fill={`url(#sg_${p.key})`} />
            ))}

            {/* Lines */}
            {chart.mode === "single" && (
              <path d={buildPath(combined, maxB)} fill="none" stroke={conflict.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {activePts.map((p) => (
              <path key={p.key} d={buildPath(parties[p.key], maxB)} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ))}

            {/* Hover crosshair */}
            {hov !== null && (
              <line
                x1={toX(hov, N)} y1={PAD.t}
                x2={toX(hov, N)} y2={PAD.t + CH}
                stroke="#2a3040" strokeWidth={1}
              />
            )}

            {/* Hover dots */}
            {hov !== null && chart.mode === "single" && (
              <circle cx={toX(hov, N)} cy={toY(combined[hov], maxB)}
                r={3.5} fill={conflict.color} stroke="#0c0f14" strokeWidth={2} />
            )}
            {hov !== null && activePts.map((p) => (
              <circle key={p.key}
                cx={toX(hov, N)} cy={toY(parties[p.key][hov], maxB)}
                r={3} fill={p.color} stroke="#0c0f14" strokeWidth={2} />
            ))}
          </svg>

          {/* Tooltip */}
          {hov !== null && (
            <div style={{
              position: "absolute",
              top: 10,
              ...(tipLeft
                ? { left: `calc(${tipXPct} + 10px)` }
                : { right: `calc(${(100 - parseFloat(tipXPct)).toFixed(1)}% + 10px)` }),
              background: "#0f1319",
              border: "1px solid #1e2330",
              borderRadius: 6,
              padding: "8px 12px",
              pointerEvents: "none",
              fontSize: 11,
              fontFamily: "monospace",
              zIndex: 10,
              minWidth: 140,
            }}>
              <div style={{ color: "#475569", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                {new Date(timestamps[hov]).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
              </div>
              {chart.mode === "single" && (
                <div style={{ color: conflict.color, fontWeight: 700 }}>
                  {fmtB(combined[hov])}
                </div>
              )}
              {chart.mode === "multi" && activePts.map((p) => (
                <div key={p.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                  <span style={{ color: "#64748b" }}>{p.name}</span>
                  <span style={{ color: p.color, fontWeight: 700 }}>{fmtB(parties[p.key][hov])}</span>
                </div>
              ))}
              {chart.mode === "multi" && (
                <div style={{ borderTop: "1px solid #1e2330", marginTop: 4, paddingTop: 4,
                  display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#475569" }}>Combined</span>
                  <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtB(combined[hov])}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Party cards ── */}
        {chart.parties.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${chart.parties.length}, 1fr)`,
            borderTop: "1px solid #1a2030",
          }}>
            {chart.parties.map((p, i) => (
              <PartyCard key={p.key} p={p} isLast={i === chart.parties.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Share This Chart modal ── */}
      {shareOpen && (() => {
        const ogUrl        = `/api/og/chart?id=${conflict.id}`;
        const sharePageUrl = `${SITE}/share/chart/${conflict.id}`;
        const isMulti      = chart.mode === "multi";
        const headline     = isMulti
          ? `${conflict.flag} ${conflict.name} — cumulative military expenditure by party. Track live: ${sharePageUrl}`
          : `${conflict.flag} ${conflict.name} — estimated spend over time. Track live: ${sharePageUrl}`;
        const tweetUrl     = `https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePageUrl)}&text=${encodeURIComponent(`${conflict.flag} ${conflict.name} — ${isMulti ? "military expenditure by party" : "spend over time"}. conflictcost.org`)}`;
        const linkedIn     = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sharePageUrl)}`;
        const facebookUrl  = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`;
        const redditUrl    = `https://reddit.com/submit?url=${encodeURIComponent(sharePageUrl)}&title=${encodeURIComponent(`${conflict.name} — Military Expenditure Over Time`)}`;

        const fullOgUrl    = `${SITE}${ogUrl}`;
        const filename     = `${conflict.id}-chart.png`;

        async function fetchImageBlob(): Promise<Blob | null> {
          try {
            const res = await fetch(fullOgUrl);
            if (res.ok) return res.blob();
          } catch {}
          return null;
        }

        async function downloadBlob(blob: Blob) {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement("a");
          a.href     = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }

        async function handleEmail() {
          const blob = await fetchImageBlob();
          if (blob) {
            const file = new File([blob], filename, { type: "image/png" });
            // Mobile: use Web Share API to hand the image file directly to Mail
            if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `${conflict.name} — Conflict Cost Chart`,
                  text: headline,
                });
                return;
              } catch {}
            }
            // Desktop fallback: download image, then open mail client
            await downloadBlob(blob);
          }
          setTimeout(() => {
            const body = blob
              ? `${headline}\n\n[Chart image saved as ${filename} — please attach it to this email]`
              : headline;
            window.location.href = `mailto:?subject=${encodeURIComponent(`${conflict.name} — Conflict Cost Chart`)}&body=${encodeURIComponent(body)}`;
          }, 400);
        }

        async function handleCopyImage() {
          const blob = await fetchImageBlob();
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            setImgCopied(true);
            setTimeout(() => setImgCopied(false), 2500);
          } catch {
            // Browser doesn't support clipboard image write — fall back to download
            await downloadBlob(blob);
          }
        }

        return (
          <div
            onClick={() => setShareOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
                     display: "flex", alignItems: "center", justifyContent: "center",
                     zIndex: 1000, padding: 20, overflowY: "auto" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#0e1218", border: "1px solid #1e2a38",
                       maxWidth: 560, width: "100%", padding: "24px 24px 20px" }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 4 }}>
                    Share This Chart
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#e8edf5" }}>
                    {conflict.flag} {conflict.name} — {isMulti ? "Expenditure by Party" : "Spend Over Time"}
                  </div>
                </div>
                <button
                  onClick={() => setShareOpen(false)}
                  style={{ background: "transparent", border: "none", color: "#3d4a5a",
                           fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              {/* Chart OG preview */}
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>
                Chart Preview
              </div>
              <div style={{ background: "#070a0d", border: "1px solid #1a2030", marginBottom: 14, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogUrl}
                  alt="Chart share preview"
                  style={{ width: "100%", display: "block", aspectRatio: "1200/630" }}
                />
              </div>

              {/* Share buttons — 3×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#000", border: "1px solid #333", color: "#fff",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px",
                           textTransform: "uppercase", textDecoration: "none",
                           display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  𝕏 X
                </a>
                <a href={linkedIn} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#0a66c2", border: "1px solid #0a66c2", color: "#fff",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px",
                           textTransform: "uppercase", textDecoration: "none",
                           display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  in LinkedIn
                </a>
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#1877f2", border: "1px solid #1877f2", color: "#fff",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px",
                           textTransform: "uppercase", textDecoration: "none",
                           display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  f Facebook
                </a>
                <a href={redditUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#ff4500", border: "1px solid #ff4500", color: "#fff",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px",
                           textTransform: "uppercase", textDecoration: "none",
                           display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  ⬆ Reddit
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(headline).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  style={{ background: copied ? "#1a3a2a" : "#1e2a38",
                           border: `1px solid ${copied ? "#2a5a3a" : "#2a3a50"}`,
                           color: copied ? "#4aaa6a" : "#c8d4e0",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1,
                           padding: "10px 8px", textTransform: "uppercase", cursor: "pointer" }}>
                  {copied ? "✓ Copied!" : "⎘ Copy Link"}
                </button>
                <button
                  onClick={handleEmail}
                  style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568",
                           fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "10px 8px",
                           textTransform: "uppercase", cursor: "pointer",
                           display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✉ Email
                </button>
              </div>

              {/* Copy Image — pastes directly into social posts */}
              <button
                onClick={handleCopyImage}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                         width: "100%", marginBottom: 8,
                         background: imgCopied ? "#1a2e1a" : "#0e1218",
                         border: `1px solid ${imgCopied ? "#2a5a3a" : "#1e2a38"}`,
                         color: imgCopied ? "#4ade80" : "#8a9ab0",
                         fontSize: 11, fontWeight: 700, letterSpacing: 2,
                         padding: "10px 12px", textTransform: "uppercase", cursor: "pointer" }}>
                {imgCopied ? "✓ Image Copied — Paste into any post" : "⧉ Copy Image to Clipboard"}
              </button>

              {/* Instagram row */}
              <button
                onClick={() => {
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  navigator.clipboard.writeText(headline).catch(() => {});
                  if (isMobile) {
                    window.open(`${SITE}${ogUrl}`, "_blank");
                  } else {
                    window.open("https://www.instagram.com/", "_blank");
                  }
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }}
                style={{ width: "100%", background: "linear-gradient(90deg,#833ab4,#fd1d1d,#fcb045)",
                         border: "none", color: "#fff", fontSize: 11, fontWeight: 700,
                         letterSpacing: 1, padding: "10px 12px", textTransform: "uppercase",
                         cursor: "pointer", marginBottom: 8,
                         display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📷 Instagram — {copied ? "Caption Copied! Open Instagram & Post" : "Copy Caption & Open Instagram"}
              </button>

              {/* Download */}
              <button
                onClick={async () => {
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  if (isMobile) {
                    window.open(fullOgUrl, "_blank");
                  } else {
                    const blob = await fetchImageBlob();
                    if (blob) await downloadBlob(blob);
                    else window.open(fullOgUrl, "_blank");
                  }
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                         width: "100%", background: "transparent", border: "1px solid #1e2530",
                         color: "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 2,
                         padding: "10px 12px", textTransform: "uppercase", cursor: "pointer" }}>
                ↓&nbsp; Download Chart Image
              </button>

              <div style={{ marginTop: 14, fontSize: 11, color: "#2d3a4a", lineHeight: 1.7 }}>
                X, LinkedIn, and Facebook auto-preview the chart image when the link is shared. Use Copy Image to paste the chart directly into any post or message.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
