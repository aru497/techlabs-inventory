import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// GET /api/inventory?limit=100 — most recently ingested items.
export async function GET(req: NextRequest) {
  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;

  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    return NextResponse.json({ items: [], configured: false });
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, sku, name, category, quantity, unit, unit_price, currency, location, owner, supplier, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [], configured: true });
}
