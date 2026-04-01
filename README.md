# Global Conflict Cost Tracker

Live, open-source military spending estimates across all major active conflicts.  
Data-driven · Source-cited · Non-partisan.

---

## Deployment (10 minutes, free)

### Prerequisites
- A [GitHub](https://github.com) account (free)
- A [Vercel](https://vercel.com) account (free, sign in with GitHub)
- [Node.js 18+](https://nodejs.org) installed locally (for local dev only)

---

### Step 1 — Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `conflict-tracker` (or anything you like)
3. Set to **Public** (required for free Vercel hobby plan)
4. Click **Create repository**

---

### Step 2 — Push this project

In your terminal, from this folder:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/conflict-tracker.git
git push -u origin main
```

---

### Step 3 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `conflict-tracker` repo
3. Leave all settings as default — Next.js is auto-detected
4. Click **Deploy**

Your site will be live at `https://conflict-tracker-XXXX.vercel.app` in ~60 seconds.

**Custom domain:** In Vercel → Project Settings → Domains → add your domain and follow DNS instructions.

---

## Adding or Updating a Conflict

All conflict data lives in one file:

```
conflicts.config.json
```

### Add a new conflict

Copy and paste this template into the array, fill in the values, and push:

```json
{
  "id": "unique-slug",
  "name": "Full Conflict Name",
  "region": "Middle East | Europe | Africa | Asia | Americas",
  "flag": "🏳️",
  "color": "#e74c3c",
  "startDate": "YYYY-MM-DD",
  "ratePerDay": 50000000,
  "anchor": 0,
  "status": "ACTIVE",
  "parties": "Side A vs. Side B",
  "sources": "SIPRI; CSIS; your source here",
  "summary": "2-3 sentences explaining how ratePerDay was derived, with specific figures cited."
}
```

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | URL-safe slug, unique |
| `name` | string | Display name |
| `region` | string | Geographic region |
| `flag` | string | Single emoji |
| `color` | string | Hex color for UI |
| `startDate` | string | `YYYY-MM-DD` of first major combat ops |
| `ratePerDay` | number | Combined direct military cost, USD/day |
| `anchor` | number | Known lump-sum already spent (e.g. from confirmed government figures), or `0` |
| `status` | string | `ACTIVE`, `CEASEFIRE`, `FROZEN`, or `ENDED` |
| `parties` | string | Who is fighting |
| `sources` | string | Comma-separated source citations |
| `summary` | string | Methodology note for transparency |

### Update an existing conflict

Edit the relevant entry in `conflicts.config.json` and push.  
Vercel auto-deploys within ~30 seconds.

### Mark a conflict as ended

Change `"status": "ACTIVE"` to `"status": "ENDED"`.  
The conflict will remain in the tracker for historical record.

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Cost Model Notes

- `ratePerDay` should reflect **combined direct military expenditure** across all major parties, including confirmed foreign military aid.
- Excluded from all figures: veteran care, reconstruction, economic spillover, classified programs.
- `anchor` is useful when a government has publicly confirmed a lump-sum spent figure (e.g. Pentagon briefed Congress at $11.3B on Day 6 — use that as your anchor, then add the ongoing rate from that point forward).
- Sources to check when setting rates: SIPRI, CSIS, Brown University Costs of War, CFR, Kiel Institute Ukraine Support Tracker, ACLED, national defense ministry statements.

---

## Project Structure

```
conflict-tracker/
├── conflicts.config.json   ← EDIT THIS to add/update conflicts
├── app/
│   ├── layout.tsx          ← SEO metadata, fonts
│   ├── page.tsx            ← Server component, reads config
│   └── globals.css
├── components/
│   ├── TrackerClient.tsx   ← Main UI (client-side, live counter)
│   ├── ConflictBar.tsx     ← Bar row in global view
│   ├── DetailPanel.tsx     ← Drill-down conflict detail
│   └── StatCard.tsx        ← Reusable stat card
├── lib/
│   ├── types.ts            ← TypeScript types
│   └── cost.ts             ← Cost calculation + formatting utils
└── public/
    └── robots.txt
```

---

## License

MIT. Use freely. Attribution appreciated but not required.
