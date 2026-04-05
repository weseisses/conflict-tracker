import type { Metadata } from "next";
import { redirect } from "next/navigation";
import conflictsData from "../../../../conflicts.config.json";
import type { Conflict } from "../../../../lib/types";

const SITE = "https://conflictcost.org";
const conflicts = conflictsData as Conflict[];

const VALID_REGIONS = ["Middle East", "Europe", "Africa", "Asia"] as const;
type Region = typeof VALID_REGIONS[number];

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

type Props = { params: { region: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const region = decodeURIComponent(params.region) as Region;
  if (!VALID_REGIONS.includes(region)) return { title: "Conflict Cost Tracker" };

  const now     = new Date();
  const active  = conflicts.filter(c => c.status === "ACTIVE" && c.region === region);
  const totCost = active.reduce((s, c) => s + calcCost(c, now), 0);
  const totRate = active.reduce((s, c) => s + c.ratePerDay, 0);
  const costStr = fmtShort(totCost);
  const hrStr   = fmtShort(totRate / 24);
  const n       = active.length;

  const title = `${region}: ${n} Active Conflict${n !== 1 ? "s" : ""} — ${costStr}`;
  const desc  = `${n} active conflict${n !== 1 ? "s" : ""} in ${region} have cost an estimated ${costStr} — ${hrStr}/hr and counting. Track it live at conflictcost.org.`;
  const ogImg = `${SITE}/api/og?region=${encodeURIComponent(region)}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/share/region/${encodeURIComponent(region)}`,
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

export default function RegionSharePage({ params }: Props) {
  const region = decodeURIComponent(params.region) as Region;
  if (!VALID_REGIONS.includes(region)) redirect("/");

  const now     = new Date();
  const active  = conflicts.filter(c => c.status === "ACTIVE" && c.region === region);
  const totCost = active.reduce((s, c) => s + calcCost(c, now), 0);
  const costStr = fmtShort(totCost);

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
            {region}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#e8edf5", letterSpacing: 1,
                        marginBottom: 8, textTransform: "uppercase" }}>
            {active.length} Active Conflict{active.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 20, color: "#f39c12", fontFamily: "monospace",
                        marginBottom: 32 }}>
            {costStr} and counting
          </div>
          <a href={`${SITE}?region=${encodeURIComponent(region)}`}
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
