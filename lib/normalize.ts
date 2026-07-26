// The normalization agent.
//
// It wraps a small LLM (Claude Haiku 4.5) rather than handing everything to it:
//   1. Deterministic pass — match source headers to canonical fields via a
//      synonym table. Free, instant, and covers the common cases.
//   2. LLM pass — only the *still-unmapped* headers (plus a few sample values)
//      are sent to Haiku, which returns a header -> canonical-field mapping.
//      One call per batch, never per row.
//   3. Apply the mapping deterministically to every row and coerce types.
//
// This keeps cost bounded and behaviour predictable while still handling
// arbitrary column names the synonym table has never seen.

import Anthropic from '@anthropic-ai/sdk';
import {
  CANONICAL_FIELDS,
  CanonicalField,
  CanonicalItem,
  FIELD_DEFS,
  FIELD_TYPE,
} from './schema';
import type { Row } from './parse';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface NormalizationResult {
  items: CanonicalItem[];
  /** header (from source) -> canonical field (or null if dropped) */
  columnMapping: Record<string, CanonicalField | null>;
  usedLlm: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_\-]+/g, ' ');

/** Pass 1: deterministic synonym matching. */
function matchBySynonyms(headers: string[]): {
  mapping: Record<string, CanonicalField | null>;
  unmapped: string[];
} {
  const mapping: Record<string, CanonicalField | null> = {};
  const used = new Set<CanonicalField>();
  const unmapped: string[] = [];

  for (const header of headers) {
    const h = norm(header);
    let matched: CanonicalField | null = null;
    for (const def of FIELD_DEFS) {
      if (used.has(def.field)) continue;
      if (def.synonyms.some((syn) => norm(syn) === h)) {
        matched = def.field;
        break;
      }
    }
    if (matched) {
      mapping[header] = matched;
      used.add(matched);
    } else {
      unmapped.push(header);
    }
  }
  return { mapping, unmapped };
}

/** Pass 2: ask Haiku to map the leftover headers. */
async function mapWithLlm(
  unmapped: string[],
  sampleRows: Row[],
  takenFields: Set<CanonicalField>,
): Promise<Record<string, CanonicalField | null>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — degrade gracefully, drop the unmapped columns.
    return Object.fromEntries(unmapped.map((h) => [h, null]));
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const available = CANONICAL_FIELDS.filter((f) => !takenFields.has(f));
  const fieldDocs = FIELD_DEFS.filter((d) => available.includes(d.field))
    .map((d) => `- ${d.field} (${d.type}): ${d.description}`)
    .join('\n');

  // A compact sample: the unmapped columns and up to 5 example values each.
  const samples = unmapped
    .map((h) => {
      const values = sampleRows
        .map((r) => r[h])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
        .slice(0, 5);
      return `"${h}": ${JSON.stringify(values)}`;
    })
    .join('\n');

  const prompt = `You are a data-normalization agent for an inventory system. Map each source column to exactly one canonical field, or to null if none fits.

Canonical fields still available:
${fieldDocs}

Rules:
- Use each canonical field at most once.
- If a column does not clearly correspond to any field, map it to null.
- Base your decision on both the column name and the sample values.

Source columns and sample values:
${samples}

Respond with ONLY a JSON object mapping each source column name to a canonical field name or null. No prose, no markdown.`;

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  const jsonText = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: Record<string, string | null> = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // If the model misbehaves, drop the unmapped columns rather than crash.
    return Object.fromEntries(unmapped.map((h) => [h, null]));
  }

  const result: Record<string, CanonicalField | null> = {};
  const taken = new Set(takenFields);
  for (const h of unmapped) {
    const val = parsed[h];
    if (val && (CANONICAL_FIELDS as string[]).includes(val) && !taken.has(val as CanonicalField)) {
      result[h] = val as CanonicalField;
      taken.add(val as CanonicalField);
    } else {
      result[h] = null;
    }
  }
  return result;
}

/** Coerce a raw cell value to the target field's type. */
function coerce(value: unknown, field: CanonicalField): string | number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '') return null;

  if (FIELD_TYPE[field] === 'number') {
    // Strip currency symbols, thousands separators, stray text.
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return s;
}

/** Full agent: headers + rows in, canonical items + mapping out. */
export async function normalize(headers: string[], rows: Row[]): Promise<NormalizationResult> {
  const { mapping, unmapped } = matchBySynonyms(headers);
  let usedLlm = false;

  if (unmapped.length > 0) {
    const taken = new Set(Object.values(mapping).filter(Boolean) as CanonicalField[]);
    const llmMapping = await mapWithLlm(unmapped, rows.slice(0, 20), taken);
    Object.assign(mapping, llmMapping);
    usedLlm = Object.values(llmMapping).some((v) => v !== null);
  }

  const items: CanonicalItem[] = rows.map((row) => {
    const item: CanonicalItem = {
      sku: null,
      name: null,
      description: null,
      category: null,
      quantity: null,
      unit: null,
      unit_price: null,
      currency: null,
      location: null,
      supplier: null,
      reorder_level: null,
      raw: row,
    };
    const target = item as unknown as Record<string, string | number | null>;
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      target[field] = coerce(row[header], field);
    }
    // Guarantee a name so the NOT NULL constraint is satisfiable downstream.
    if (!item.name) {
      item.name = item.sku || item.description || 'Unnamed item';
    }
    return item;
  });

  return { items, columnMapping: mapping, usedLlm };
}
