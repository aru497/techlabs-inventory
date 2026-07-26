import { NextRequest, NextResponse } from 'next/server';
import { parseFile, parseGoogleSheet, ParsedSource } from '@/lib/parse';
import { normalize } from '@/lib/normalize';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/ingest
//   multipart/form-data with a `file` field, OR
//   application/json { "sheetUrl": "https://docs.google.com/spreadsheets/..." }
export async function POST(req: NextRequest) {
  let parsed: ParsedSource = { rows: [], headers: [] };
  let sourceType: 'file' | 'google_sheet' = 'file';
  let sourceName = '';

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }
      sourceType = 'file';
      sourceName = file.name;
      parsed = await parseFile(file.name, await file.arrayBuffer());
    } else {
      const body = await req.json().catch(() => ({}));
      const sheetUrl = (body?.sheetUrl || '').trim();
      if (!sheetUrl) {
        return NextResponse.json({ error: 'No file or sheetUrl provided.' }, { status: 400 });
      }
      sourceType = 'google_sheet';
      sourceName = sheetUrl;
      parsed = await parseGoogleSheet(sheetUrl);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the source.' },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in the source.' }, { status: 400 });
  }

  // Normalize (rules-first + Haiku for the ambiguous columns).
  let normalized;
  try {
    normalized = await normalize(parsed.headers, parsed.rows);
  } catch (err) {
    return NextResponse.json(
      { error: `Normalization failed: ${err instanceof Error ? err.message : 'unknown error'}` },
      { status: 500 },
    );
  }

  // Persist to Supabase: create a batch, then insert the items.
  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Supabase not configured.',
        // Still return the normalized preview so the pipeline is inspectable
        // even before the DB is wired up.
        preview: normalized.items.slice(0, 20),
        columnMapping: normalized.columnMapping,
      },
      { status: 503 },
    );
  }

  const { data: batch, error: batchErr } = await supabase
    .from('ingestion_batches')
    .insert({
      source_type: sourceType,
      source_name: sourceName,
      status: 'normalized',
      row_count: normalized.items.length,
      column_mapping: normalized.columnMapping,
    })
    .select()
    .single();

  if (batchErr || !batch) {
    return NextResponse.json(
      { error: `Could not create ingestion batch: ${batchErr?.message}` },
      { status: 500 },
    );
  }

  const records = normalized.items.map((item) => ({
    batch_id: batch.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    currency: item.currency,
    location: item.location,
    supplier: item.supplier,
    reorder_level: item.reorder_level,
    source: sourceName,
    raw: item.raw,
  }));

  const { error: insertErr } = await supabase.from('inventory_items').insert(records);

  if (insertErr) {
    await supabase
      .from('ingestion_batches')
      .update({ status: 'failed', error: insertErr.message })
      .eq('id', batch.id);
    return NextResponse.json(
      { error: `Insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  await supabase.from('ingestion_batches').update({ status: 'ingested' }).eq('id', batch.id);

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    sourceType,
    sourceName,
    rowsIngested: records.length,
    usedLlm: normalized.usedLlm,
    columnMapping: normalized.columnMapping,
    preview: normalized.items.slice(0, 10),
  });
}
