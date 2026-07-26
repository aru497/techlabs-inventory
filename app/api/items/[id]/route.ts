import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sanitize } from '@/lib/items';
import { adminPass } from '@/lib/auth';

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

// DELETE /api/items/:id — destructive, so it demands the admin password again
// (defence in depth on top of the session cookie: a hijacked tab still can't
// delete without re-proving the password).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = String(body?.password ?? '');
  if (!password || password !== adminPass()) {
    return NextResponse.json(
      { error: 'Incorrect password. Deleting requires re-entering the admin password.' },
      { status: 403 },
    );
  }

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
