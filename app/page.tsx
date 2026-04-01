import conflicts from "../conflicts.config.json";
import type { Conflict } from "../lib/types";
import TrackerClient from "../components/TrackerClient";

export const revalidate = 60; // ISR: re-read config every 60s in production

export default function Home() {
  return <TrackerClient conflicts={conflicts as Conflict[]} />;
}
