import { normalizeStatus } from './itam';

// Whitelisted, sanitized fields for manual create/update — prevents arbitrary
// column writes and coerces types the way the DB expects.

const TEXT_FIELDS = ['sku', 'name', 'description', 'category', 'unit', 'currency', 'location', 'owner', 'supplier', 'assigned_to', 'notes'];
const NUM_FIELDS = ['quantity', 'unit_price', 'reorder_level'];

export function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    if (f in body) {
      const v = body[f];
      rec[f] = v === '' || v == null ? null : String(v);
    }
  }
  for (const f of NUM_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (v === '' || v == null) rec[f] = null;
      else {
        const n = Number(v);
        rec[f] = Number.isFinite(n) ? n : null;
      }
    }
  }
  if ('status' in body) rec.status = normalizeStatus(String(body.status ?? '')) || 'in_stock';
  if ('next_calibration' in body) {
    const v = body.next_calibration;
    rec.next_calibration = v === '' || v == null ? null : String(v);
  }
  return rec;
}
