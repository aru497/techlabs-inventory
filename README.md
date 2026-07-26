# TechLabs Inventory

Upload a file **or** paste a Google Sheet link → a normalization **agent** maps any
column layout onto one canonical inventory schema → rows are ingested into
**Supabase (Postgres)**.

The agent wraps a *small* LLM instead of leaning on it for everything:

1. **Rules first** — source headers are matched to canonical fields via a synonym
   table. Free, instant, deterministic.
2. **LLM only for the leftovers** — the still-unmapped headers (plus a few sample
   values) are sent to **Claude Haiku 4.5** once per batch, which returns a
   column → field mapping. Never one call per row.
3. **Apply + coerce** — the mapping is applied to every row and values are typed
   (numbers stripped of currency symbols, etc.).

## Stack

- Next.js 14 (App Router) + TypeScript — deploys to Vercel
- Supabase Postgres (`@supabase/supabase-js`)
- Anthropic SDK (`claude-haiku-4-5-20251001`)
- `papaparse` (CSV) + `xlsx` (Excel)

## Canonical schema

`sku, name, description, category, quantity, unit, unit_price, currency,
location, supplier, reorder_level` — plus `raw` (original row, for audit) and a
`batch_id` linking back to the `ingestion_batches` record. See
[`supabase/schema.sql`](supabase/schema.sql).

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Create the database** — in your Supabase project, open the SQL editor and run
   [`supabase/schema.sql`](supabase/schema.sql).
3. **Configure env** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

> Without Supabase keys the pipeline still runs and returns a normalized preview
> (HTTP 503 with `preview` + `columnMapping`), so you can test normalization
> before wiring the DB.

## How ingestion works

```
file / sheet ──▶ parse.ts ──▶ normalize.ts (rules + Haiku) ──▶ Supabase
   (any format)   rows[]        CanonicalItem[]                inventory_items
```

- **File upload** → `POST /api/ingest` (multipart, `file` field)
- **Google Sheet** → `POST /api/ingest` (JSON, `{ sheetUrl }`). The URL is
  rewritten to its CSV export endpoint; the sheet must be link-shared as Viewer.
- **Listing** → `GET /api/inventory?limit=200`

## Try it

A messy sample lives in [`samples/sample_inventory.csv`](samples/sample_inventory.csv)
— deliberately odd headers (`Item Code`, `Qty On Hand`, `Rate`) so you can watch
the agent map them.

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel, and add the four env vars above in the
project settings. `vercel.json` is included.
