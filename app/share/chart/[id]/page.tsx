import type { Metadata } from "next";
import { redirect } from "next/navigation";
import conflictsData from "../../../../conflicts.config.json";
import type { Conflict } from "../../../../lib/types";

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

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict || !conflict.spendChart) return { title: "Conflict Cost Tracker" };

  const cost    = calcCost(conflict, new Date());
  const costStr = fmtShort(cost);
  const isMulti = conflict.spendChart.mode === "multi";
  const title   = `${conflict.flag} ${conflict.name} — Expenditure Over Time`;
  const desc    = isMulti
    ? `${conflict.name} cumulative military expenditure by party — est. ${costStr} total. Interactive tracker at conflictcost.org.`
    : `${conflict.name} has cost an estimated ${costStr} in direct military expenditure. See the full timeline at conflictcost.org.`;
  const ogImg   = `${SITE}/api/og/chart?id=${conflict.id}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/share/chart/${conflict.id}`,
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

export default function ShareChartPage({ params }: Props) {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict || !conflict.spendChart) redirect("/");

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080b10", fontFamily: "sans-serif", minHeight: "100vh",
                     display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 14, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase",
                        marginBottom: 16 }}>
            Conflict Cost Tracker
          </div>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{conflict.flag}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#e8edf5", letterSpacing: 1,
                        marginBottom: 8, textTransform: "uppercase" }}>
            {conflict.name}
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, color: conflict.color, textTransform: "uppercase",
                        marginBottom: 32 }}>
            {conflict.spendChart.mode === "multi" ? "Expenditure by Party" : "Spend Over Time"}
          </div>
          <a href={`${SITE}/conflict/${conflict.id}`}
             style={{ display: "inline-block", background: conflict.color, color: "#fff",
                      fontSize: 13, fontWeight: 700, letterSpacing: 3, padding: "12px 28px",
                      textDecoration: "none", textTransform: "uppercase" }}>
            View Live Chart →
          </a>
        </div>
      </body>
    </html>
  );
}
