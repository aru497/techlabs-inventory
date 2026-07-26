-- IT Asset Management lifecycle fields.
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.inventory_items
  add column if not exists status           text not null default 'in_stock',
  add column if not exists assigned_to      text,
  add column if not exists next_calibration date,
  add column if not exists notes            text;

create index if not exists inventory_items_status_idx on public.inventory_items (status);
create index if not exists inventory_items_nextcal_idx on public.inventory_items (next_calibration);
