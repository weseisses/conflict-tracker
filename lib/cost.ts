import type { Conflict } from "./types";

export function calcCost(conflict: Conflict, now: Date): number {
  const start = new Date(conflict.startDate + "T00:00:00Z");
  // For ended/frozen conflicts, cap at endDate so counter doesn't keep ticking
  const ceiling = conflict.endDate ? new Date(conflict.endDate + "T00:00:00Z") : now;
  const effectiveNow = ceiling < now ? ceiling : now;
  const elapsedMs = effectiveNow.getTime() - start.getTime();
  if (elapsedMs < 0) return 0;
  return (conflict.anchor || 0) + (elapsedMs / 86_400_000) * conflict.ratePerDay;
}

export function daysSince(dateStr: string): number {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(dateStr + "T00:00:00Z").getTime()) / 86_400_000
    )
  );
}

export function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(decimals) + " Trillion";
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(decimals) + " Billion";
  if (n >= 1e6)  return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString();
}

export function fmtLive(n: number): { val: string; unit: string } {
  if (n >= 1e12) return { val: (n / 1e12).toFixed(3), unit: "Trillion" };
  if (n >= 1e9)  return { val: (n / 1e9).toFixed(3),  unit: "Billion" };
  return { val: Math.round(n).toLocaleString(), unit: "" };
}
