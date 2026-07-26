import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sanitize } from '@/lib/items';

export const runtime = 'nodejs';

// PATCH /api/items/:id — update fields (including lifecycle status).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const rec = sanitize(body);
  if (Object.keys(rec).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured.' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update(rec)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

// DELETE /api/items/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured.' }, { status: 503 });
  }

  const { error } = await supabase.from('inventory_items').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
