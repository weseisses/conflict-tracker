import type { Metadata } from "next";
import { notFound } from "next/navigation";
import conflictsData from "../../../conflicts.config.json";
import type { Conflict } from "../../../lib/types";
import TrackerClient from "../../../components/TrackerClient";

export const revalidate = 60;

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

export async function generateStaticParams() {
  return conflicts.map(c => ({ id: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict) return { title: "Conflict Cost Tracker" };

  const now        = new Date();
  const cost       = calcCost(conflict, now);
  const costStr    = fmtShort(cost);
  const hourlyStr  = fmtShort(conflict.ratePerDay / 24);
  const isActive   = conflict.status === "ACTIVE";
  const statusNote = isActive ? `${hourlyStr}/hr and counting` : "final estimate";

  const title = `${conflict.flag} ${conflict.name} — ${costStr}`;
  const desc  = `${conflict.name} has cost an estimated ${costStr} — ${statusNote}. Track it live at conflictcost.org.`;
  const ogImg = `${SITE}/api/og?id=${conflict.id}`;
  const url   = `${SITE}/conflict/${conflict.id}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
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

export default function ConflictPage({ params }: Props) {
  const conflict = conflicts.find(c => c.id === params.id);
  if (!conflict) notFound();

  return <TrackerClient conflicts={conflicts} initialConflict={conflict.id} />;
}
