import type { Metadata } from "next";
import conflictsData from "../../../conflicts.config.json";
import type { Conflict } from "../../../lib/types";

const SITE = "https://conflictcost.org";
const conflicts = conflictsData as Conflict[];

function calcCost(c: Conflict, now: Date): number {
  const start   = new Date(c.startDate + "T00:00:00Z");
  const ceiling = c.endDate ? new Date(c.endDate + "T00:00:00Z") : now;
  const eff     = ceiling < now ? ceiling : now;
  const ms      = eff.getTime() - start.getTime();
  if (ms < 0) return 0;
  return (c.anchor || 0) + (ms / 86_400_000) * c.ratePerDay;
}

function fmtShort(n: number): string {
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + " Trillion";
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(1) + " Billion";
  if (n >= 1e6)  return "$" + (n / 1e6).toFixed(0) + "M";
  return "$" + Math.round(n).toLocaleString();
}

export async function generateMetadata(): Promise<Metadata> {
  const now      = new Date();
  const totCost  = conflicts.reduce((s, c) => s + calcCost(c, now), 0);
  const active   = conflicts.filter(c => c.status === "ACTIVE");
  const totRate  = active.reduce((s, c) => s + c.ratePerDay, 0);
  const costStr  = fmtShort(totCost);
  const hrStr    = fmtShort(totRate / 24);
  const n        = conflicts.length;
  const nActive  = active.length;

  const title = `${n} Conflicts Tracked — ${costStr} Combined`;
  const desc  = `${n} conflicts tracked worldwide (${nActive} active) — combined cost: ${costStr}. Active conflicts are still burning ${hrStr}/hr. Track it live at conflictcost.org.`;
  const ogImg = `${SITE}/api/og?all=1`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/share/all`,
      siteName: "Conflict Cost Tracker",
      images: [{ url: ogImg, width: 1200, height: 630, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImg],
    },
  };
}

export default function AllConflictsSharePage() {
  const now      = new Date();
  const totCost  = conflicts.reduce((s, c) => s + calcCost(c, now), 0);
  const active   = conflicts.filter(c => c.status === "ACTIVE");
  const costStr  = fmtShort(totCost);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080b10", fontFamily: "sans-serif", minHeight: "100vh",
                     display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 14, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase",
                        marginBottom: 16 }}>
            Conflict Cost Tracker
          </div>
          <div style={{ fontSize: 13, letterSpacing: 3, color: "#e74c3c", textTransform: "uppercase",
                        marginBottom: 8 }}>
            All Tracked Conflicts
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#e8edf5", letterSpacing: 1,
                        marginBottom: 8, textTransform: "uppercase" }}>
            {conflicts.length} Conflicts · {active.length} Active
          </div>
          <div style={{ fontSize: 20, color: "#f39c12", fontFamily: "monospace",
                        marginBottom: 32 }}>
            {costStr} combined
          </div>
          <a href={`${SITE}?filter=all`}
             style={{ display: "inline-block", background: "#e74c3c", color: "#fff",
                      fontSize: 13, fontWeight: 700, letterSpacing: 3, padding: "12px 28px",
                      textDecoration: "none", textTransform: "uppercase" }}>
            View Live Counter →
          </a>
        </div>
      </body>
    </html>
  );
}
