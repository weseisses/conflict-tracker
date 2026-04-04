import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict) return { title: "Conflict Cost Tracker" };

  const cost      = calcCost(conflict, new Date());
  const costStr   = fmtShort(cost);
  const hourlyStr = fmtShort(conflict.ratePerDay / 24);
  const title     = `${conflict.flag} ${conflict.name} — ${costStr}`;
  const desc      = `${conflict.name} has cost an estimated ${costStr} — ${hourlyStr}/hr and counting. Track it live at conflictcost.org.`;
  const ogImg     = `${SITE}/api/og?id=${conflict.id}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/share/${conflict.id}`,
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

export default function SharePage({ params }: Props) {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict) redirect("/");

  // Render a minimal branded page — social scrapers read the OG meta above,
  // humans who click through see this and are invited to the live tracker.
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
                        marginBottom: 32, textTransform: "uppercase" }}>
            {conflict.name}
          </div>
          <a href={SITE}
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
