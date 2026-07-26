-- techlabs-inventory — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.

create extension if not exists "pgcrypto";

-- ─── Ingestion batches ───────────────────────────────────────────────────────
-- One row per upload/sheet ingest. Tracks provenance + outcome.
create table if not exists public.ingestion_batches (
  id            uuid primary key default gen_random_uuid(),
  source_type   text not null check (source_type in ('file', 'google_sheet')),
  source_name   text not null,                 -- filename or sheet URL
  status        text not null default 'pending'
                  check (status in ('pending', 'normalized', 'ingested', 'failed')),
  row_count     integer not null default 0,
  error         text,
  -- how the agent mapped the source columns to canonical fields
  column_mapping jsonb,
  created_at    timestamptz not null default now()
);

-- ─── Inventory items (canonical schema) ──────────────────────────────────────
create table if not exists public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid references public.ingestion_batches(id) on delete set null,
  sku           text,
  name          text not null,
  description   text,
  category      text,
  quantity      numeric,
  unit          text,                           -- each, box, kg, ...
  unit_price    numeric,
  currency      text,
  location      text,
  owner         text,                           -- customer this stock belongs to
  supplier      text,
  reorder_level numeric,
  source        text,                           -- filename or sheet URL
  raw           jsonb,                           -- original row, for audit
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists inventory_items_sku_idx      on public.inventory_items (sku);
create index if not exists inventory_items_category_idx on public.inventory_items (category);
create index if not exists inventory_items_owner_idx    on public.inventory_items (owner);
create index if not exists inventory_items_location_idx on public.inventory_items (location);
create index if not exists inventory_items_batch_idx    on public.inventory_items (batch_id);
create index if not exists inventory_items_created_idx  on public.inventory_items (created_at desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Writes go through the API using the SERVICE ROLE key (bypasses RLS).
-- The browser uses the ANON key for read-only listing, so we enable RLS and
-- allow anonymous SELECT only. Tighten this once auth is added.
alter table public.inventory_items    enable row level security;
alter table public.ingestion_batches  enable row level security;

drop policy if exists "public read inventory" on public.inventory_items;
create policy "public read inventory"
  on public.inventory_items for select
  to anon, authenticated
  using (true);

drop policy if exists "public read batches" on public.ingestion_batches;
create policy "public read batches"
  on public.ingestion_batches for select
  to anon, authenticated
  using (true);
