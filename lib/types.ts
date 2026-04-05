export interface CasualtyEntry {
  label: string;   // e.g. "Russia (KIA)", "Palestinian civilians"
  count: string;   // e.g. "80,000–120,000" or "~46,000"
}

export interface Casualties {
  asOf: string;          // "YYYY-MM" — when figures were last sourced
  source: string;        // primary sources
  note?: string;         // data quality caveat
  entries: CasualtyEntry[];
}

export interface SpendParty {
  key: string;
  flag: string;
  name: string;
  role: string;
  confidence: "high" | "medium" | "none";
  explainer: string;       // 1–2 sentence context shown in the card
  color: string;
  estimate?: { low: number; mid: number; high: number }; // USD billions
  dailyLabel?: string;     // e.g. "~$425M/day"
}

export interface RatePoint {
  date: string;                        // "YYYY-MM-DD" — when this rate takes effect
  rate?: number;                       // combined USD/day (single-line mode)
  rates?: Record<string, number>;      // per-party USD/day (multi-line mode)
}

export interface SpendChartConfig {
  mode: "multi" | "single";
  parties: SpendParty[];
  rateHistory?: RatePoint[];  // absent → straight line from conflict.ratePerDay
  note?: string;              // small caption shown next to section label
}

export interface Conflict {
  id: string;
  name: string;
  region: string;
  flag: string;
  color: string;
  startDate: string;   // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD — if present, counter is frozen at this date
  ratePerDay: number;  // USD per day
  anchor: number;      // front-loaded known cost (USD), or 0
  status: "ACTIVE" | "CEASEFIRE" | "FROZEN" | "ENDED";
  parties: string;
  sources: string;
  summary: string;
  comparables?: string[];    // "compared to what?" equivalency lines
  casualties?: Casualties;   // human cost — static estimates with source dates
  spendChart?: SpendChartConfig;
}
