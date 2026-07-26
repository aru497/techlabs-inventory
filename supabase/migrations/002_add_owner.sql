-- Add the customer/owner dimension so assets can be filtered by who they belong to.
-- Run this in the Supabase SQL editor. Safe to re-run.

alter table public.inventory_items
  add column if not exists owner text;

create index if not exists inventory_items_owner_idx
  on public.inventory_items (owner);
