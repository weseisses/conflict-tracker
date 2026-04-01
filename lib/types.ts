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
}
