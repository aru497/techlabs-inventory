import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sanitize } from '@/lib/items';

export const runtime = 'nodejs';

// POST /api/items — create a single asset.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rec = sanitize(body);

  if (!rec.name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (rec.status == null) rec.status = 'in_stock';
  rec.source = 'manual';

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured.' }, { status: 503 });
  }

  const { data, error } = await supabase.from('inventory_items').insert(rec).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
