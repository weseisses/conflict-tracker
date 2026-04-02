import type { Metadata } from "next";
import type { Conflict } from "../../lib/types";
import conflicts from "../../conflicts.config.json";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — Global Conflict Cost Tracker",
  description:
    "How ConflictCost.org estimates military spending: cost model, data sources, inclusions, exclusions, and per-conflict calibration details.",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:     "Active",
  CEASEFIRE:  "Ceasefire",
  FROZEN:     "Frozen",
  ENDED:      "Ended",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#e74c3c",
  CEASEFIRE: "#f39c12",
  FROZEN:    "#4a90d9",
  ENDED:     "#4a5568",
};

function fmt(n: number): string {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(0) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
  return "$" + Math.round(n).toLocaleString();
}

export default function MethodologyPage() {
  const c = conflicts as Conflict[];
  const active = c.filter(x => x.status === "ACTIVE");

  return (
    <div style={{ minHeight: "100vh", background: "#0c0f14", color: "#f0f4f8", fontFamily: "'Barlow Condensed', sans-serif" }}>

      {/* fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c0f14; }
        a { color: #4a90d9; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #1a2030; padding: 10px 14px; text-align: left; vertical-align: top; }
        th { background: #0a0c10; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #3d4a5a; font-weight: 700; }
        td { font-size: 13px; color: #c8d4e0; line-height: 1.6; }
        tr:hover td { background: #0e121a; }
        .mono { font-family: 'Share Tech Mono', monospace; }
        code { font-family: 'Share Tech Mono', monospace; background: #111820; padding: 2px 7px; border-radius: 3px; font-size: 13px; color: #f39c12; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#0c0f14", borderBottom: "1px solid #1a2030", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#e74c3c", color: "#fff", fontWeight: 800, fontSize: 10, letterSpacing: 2, padding: "4px 10px" }}>GLOBAL</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#e8edf5" }}>CONFLICT COST TRACKER</div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#3d4a5a", textTransform: "uppercase" }}>
              {active.length} active conflicts · {c.length} total tracked
            </div>
          </div>
        </div>
        <Link href="/" style={{ background: "transparent", border: "1px solid #1e2530", color: "#4a5568", fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "5px 14px", textTransform: "uppercase", textDecoration: "none" }}>
          ← Live Tracker
        </Link>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 8 }}>Documentation</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: 2, color: "#f0f4f8", marginBottom: 14 }}>Methodology</h1>
          <p style={{ fontSize: 15, color: "#7a8a9a", lineHeight: 1.8, maxWidth: 680 }}>
            ConflictCost.org provides real-time estimates of direct military expenditure across all major active and recent conflicts.
            This page explains the cost model, data sources, and calibration approach used for every conflict entry.
          </p>
        </div>

        {/* COST MODEL */}
        <Section title="Cost Model">
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 20 }}>
            Each conflict's running total is computed from three parameters:
          </p>

          <div style={{ background: "#0a0c10", border: "1px solid #1a2030", padding: "24px 28px", marginBottom: 24, fontFamily: "'Share Tech Mono', monospace", fontSize: 15, color: "#f39c12", lineHeight: 2.2 }}>
            <div style={{ color: "#3d4a5a", fontSize: 10, letterSpacing: 3, marginBottom: 8 }}>FORMULA</div>
            totalCost = anchor + (daysSinceStart × ratePerDay)
          </div>

          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ width: "18%" }}>Parameter</th>
                <th style={{ width: "15%" }}>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>anchor</code></td>
                <td><span style={{ color: "#4a90d9" }}>USD lump sum</span></td>
                <td>A calibration constant capturing costs already incurred before the ongoing rate applies. Derived by solving: <code>anchor = knownTotal − (knownDays × ratePerDay)</code>. Often $0 for conflicts where a single daily rate is a reasonable lifetime average.</td>
              </tr>
              <tr>
                <td><code>ratePerDay</code></td>
                <td><span style={{ color: "#4a90d9" }}>USD / day</span></td>
                <td>The current (or characteristic) daily military spending across all parties. For ongoing conflicts, this reflects the most recently reportable sustained rate. For ended conflicts, it represents the conflict-lifetime average.</td>
              </tr>
              <tr>
                <td><code>startDate</code></td>
                <td><span style={{ color: "#4a90d9" }}>YYYY-MM-DD</span></td>
                <td>The date from which the counter begins running. For long-running conflicts where earlier phases are not tracked (e.g. Afghanistan: only 2011–2021), this may differ from the absolute start of hostilities.</td>
              </tr>
              <tr>
                <td><code>endDate</code></td>
                <td><span style={{ color: "#4a90d9" }}>YYYY-MM-DD (optional)</span></td>
                <td>When set, the counter is frozen at this date. No further cost accrues after the end date, even as real time passes. Used for ENDED and FROZEN conflicts.</td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.8 }}>
            The ticker updates every 300 ms, interpolating sub-day costs in real time: cost accrues continuously at <code>ratePerDay ÷ 86,400</code> per second.
          </p>
        </Section>

        {/* WHAT'S INCLUDED / EXCLUDED */}
        <Section title="Scope: What's Included and Excluded">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div style={{ background: "#0a1208", border: "1px solid #1a2a14", padding: "18px 20px" }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#4a8a3a", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>✓ Included</div>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Direct military operations (munitions, sorties, naval deployments)",
                  "Foreign military aid in delivery (e.g. U.S. weapons to Ukraine, to Israel)",
                  "Mobilization and reinforcement costs",
                  "Intelligence, surveillance, reconnaissance (ISR) operational costs",
                  "Concurrent theater costs (multi-party conflicts counted once under primary entry)",
                  "Published defense budget increases directly attributable to the conflict",
                ].map(item => (
                  <li key={item} style={{ fontSize: 13, color: "#7a9a6a", lineHeight: 1.6, paddingLeft: 14, borderLeft: "2px solid #2a4a1a" }}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={{ background: "#120a0a", border: "1px solid #2a1414", padding: "18px 20px" }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#8a3a3a", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>✗ Excluded</div>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Long-term veteran healthcare and disability payments",
                  "Reconstruction and post-conflict stabilization costs",
                  "Economic spillover (GDP losses, trade disruption, food price impacts)",
                  "Classified or unreported defense programs",
                  "Humanitarian aid and refugee support costs",
                  "Interest on war-related debt",
                  "Indirect economic costs to civilian populations",
                ].map(item => (
                  <li key={item} style={{ fontSize: 13, color: "#9a6a6a", lineHeight: 1.6, paddingLeft: 14, borderLeft: "2px solid #4a1a1a" }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#3d4a5a", marginTop: 12, lineHeight: 1.7 }}>
            Note: "Costs of War" research (e.g. Brown University's full-lifecycle estimates for Afghanistan at $2.3T+) incorporates many of the excluded categories above and will produce figures significantly higher than those shown here. ConflictCost.org focuses exclusively on direct military expenditure.
          </p>
        </Section>

        {/* DATA SOURCES */}
        <Section title="Primary Data Sources">
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 20 }}>
            Figures are drawn from the following primary sources, in approximate order of authority:
          </p>
          <table>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Source</th>
                <th>What it provides</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["SIPRI Military Expenditure Database", "Annual national defense budgets by country, released each April for the prior year. Used as baseline for most state-level spending."],
                ["CSIS (Center for Strategic & International Studies)", "Rapid-response cost analyses for major operations, e.g. Op. Epic Fury cost breakdowns in March 2026."],
                ["Brown University Costs of War Project", "Comprehensive lifecycle cost research for U.S.-led wars (Afghanistan, Iraq, post-9/11). Used for total-war benchmarks."],
                ["CFR / Council on Foreign Relations", "Aid tracker data (Ukraine, Israel), conflict-specific budget analyses."],
                ["U.S. Government Accountability Office (GAO)", "Confirmed U.S. military support figures for Saudi Arabia/Yemen, Afghanistan."],
                ["Pentagon Congressional briefings (via Military Times, Breaking Defense)", "Operational cost disclosures; used for Op. Epic Fury Day 6 figure ($11.3B)."],
                ["Bank of Israel", "Direct defense cost reporting for Israel-Gaza conflict through 2025."],
                ["Penn Wharton Budget Model", "Independent estimates of sustained U.S. operational costs for Iran campaign."],
                ["ACLED (Armed Conflict Location & Event Data)", "Conflict intensity data used to validate spending rates for Sahel, DRC, and other sub-Saharan conflicts."],
                ["Kiel Institute Ukraine Support Tracker", "European and U.S. military aid flows to Ukraine."],
                ["IISS Military Balance", "Cross-country force size and spending benchmarks; used for Myanmar, Lebanon, DRC."],
              ].map(([src, desc]) => (
                <tr key={src as string}>
                  <td style={{ color: "#c8d4e0", fontWeight: 600 }}>{src}</td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* PER-CONFLICT TABLE */}
        <Section title="Per-Conflict Parameters">
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 20 }}>
            The table below shows the exact calibration parameters for every tracked conflict,
            along with the key sources supporting each estimate.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Conflict</th>
                  <th style={{ width: "9%" }}>Status</th>
                  <th style={{ width: "12%" }}>Rate / Day</th>
                  <th style={{ width: "12%" }}>Anchor</th>
                  <th style={{ width: "10%" }}>Start Date</th>
                  <th>Key Sources</th>
                </tr>
              </thead>
              <tbody>
                {(c as Conflict[]).map((conflict) => (
                  <tr key={conflict.id}>
                    <td>
                      <span style={{ marginRight: 6 }}>{conflict.flag}</span>
                      <span style={{ fontWeight: 600, color: "#e8edf5" }}>{conflict.name}</span>
                      <div style={{ fontSize: 11, color: "#3d4a5a", marginTop: 2 }}>{conflict.parties}</div>
                    </td>
                    <td>
                      <span style={{ color: STATUS_COLOR[conflict.status] || "#4a5568", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                        {STATUS_LABEL[conflict.status] || conflict.status}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "#f39c12", fontSize: 13 }}>
                      {fmt(conflict.ratePerDay)}/day
                    </td>
                    <td className="mono" style={{ color: conflict.anchor ? "#4a90d9" : "#2d3a4a", fontSize: 13 }}>
                      {conflict.anchor ? fmt(conflict.anchor) : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "#7a8a9a" }}>
                      {conflict.startDate}
                      {conflict.endDate && <div style={{ color: "#3d4a5a" }}>→ {conflict.endDate}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: "#6a7a8a", lineHeight: 1.7 }}>
                      {conflict.sources}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* NOTABLE CALIBRATIONS */}
        <Section title="Notable Calibrations">
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 20 }}>
            Some conflicts require special explanation of how parameters were derived:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              {
                name: "Operation Epic Fury (Iran, 2026)",
                color: "#e74c3c",
                text: `Anchor of $11.5B calibrated so the formula returns the Middle East Monitor-cited figure of ~$27.5B at Day 32 (April 1, 2026): $11.5B + (32 × $500M) = $27.5B. The $500M/day sustained rate reflects the Penn Wharton Budget Model's post-Day-25 estimate as operations shifted to lower-cost munitions. The higher early rates ($1B+/day in the first 6 days per Pentagon/CSIS) are captured by the anchor.`
              },
              {
                name: "Russia–Ukraine War",
                color: "#3498db",
                text: `$825M/day is a combined figure: Russia ~$165B/yr (SIPRI/UkraineWorld 2026 defense budget of 14.9T roubles) + Ukraine ~$71B/yr + European military aid ~$65B/yr. The U.S. withdrew ~99% of direct military support in 2025. Anchor is $0 because a single blended daily rate is used from the Feb 24, 2022 start date.`
              },
              {
                name: "Gaza / Middle East Wars",
                color: "#e67e22",
                text: `Anchor of $16B captures the Bank of Israel's confirmed ~$77B direct defense cost through the Oct 2025 ceasefire, net of the ongoing $100M/day ceasefire-phase rate. The pre-ceasefire rate has been reduced from earlier estimates that inadvertently double-counted Iran escalation costs now tracked separately under Op. Epic Fury.`
              },
              {
                name: "The Twelve-Day War (June 2025)",
                color: "#1abc9c",
                text: `Counter is frozen at June 25, 2025. Total of ~$18B over 12 days yields an average $1.5B/day. Anchor is $0 since the average rate × 12 days = $18B matches the source total. This operation served as the tactical blueprint for Op. Epic Fury (Feb 2026).`
              },
            ].map(item => (
              <div key={item.name} style={{ borderLeft: `3px solid ${item.color}`, paddingLeft: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8edf5", marginBottom: 6 }}>{item.name}</div>
                <p style={{ fontSize: 13, color: "#7a8a9a", lineHeight: 1.8 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* UPDATE CADENCE */}
        <Section title="Update Cadence & Accuracy">
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 16 }}>
            Conflict parameters are reviewed and updated when credible new primary source data becomes available — typically when SIPRI releases annual data (April each year), when major government bodies publish new cost disclosures, or when significant operational changes alter spending rates.
          </p>
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9, marginBottom: 16 }}>
            All figures should be understood as <strong style={{ color: "#c8d4e0" }}>orders-of-magnitude estimates</strong>, not precise accounting. Military expenditure data for active conflicts is frequently incomplete, classified, or subject to retrospective revision. The goal is accurate framing of the scale and relative magnitude of conflict costs, not audit-grade precision.
          </p>
          <p style={{ fontSize: 14, color: "#7a8a9a", lineHeight: 1.9 }}>
            Discrepancies with other trackers often arise from different scope (e.g. including vs. excluding veteran care), different rate periods (early high-intensity vs. sustained phase), or political framing in the source material. ConflictCost.org aims for conservative, defensible estimates grounded in the most authoritative available data.
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 18, borderTop: "1px solid #1a2030", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#2d3a4a" }}>
            ConflictCost.org · Non-partisan · No advertising · Open methodology
          </div>
          <Link href="/" style={{ fontSize: 11, color: "#4a5568", letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", border: "1px solid #1e2530", padding: "5px 14px" }}>
            ← Back to Live Tracker
          </Link>
        </div>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 52 }}>
      <div style={{ fontSize: 10, letterSpacing: 4, color: "#3d4a5a", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
        ——
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, color: "#e8edf5", marginBottom: 20 }}>{title}</h2>
      {children}
    </section>
  );
}
