// IT Asset Management domain: lifecycle statuses, item shape, helpers.
// Pure module — safe to import from both server routes and client components.

export const STATUSES = [
  { key: 'in_stock', label: 'In Stock', tone: 'stock', hint: 'Available in a warehouse' },
  { key: 'deployed', label: 'Deployed', tone: 'deployed', hint: 'Issued / in the field' },
  { key: 'in_repair', label: 'In Repair', tone: 'repair', hint: 'Under maintenance or calibration' },
  { key: 'retired', label: 'Retired', tone: 'retired', hint: 'Decommissioned, end of life' },
  { key: 'recycled', label: 'Recycled', tone: 'recycled', hint: 'Disposed / e-waste recycled' },
] as const;

export type Status = (typeof STATUSES)[number]['key'];
export const STATUS_KEYS: string[] = STATUSES.map((s) => s.key);
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
export const STATUS_TONE: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.key, s.tone]));

/** Map free-text status values from uploads onto the canonical lifecycle keys. */
export function normalizeStatus(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  const map: Record<string, string> = {
    'in stock': 'in_stock', stock: 'in_stock', available: 'in_stock', 'in store': 'in_stock', instock: 'in_stock',
    deployed: 'deployed', 'in field': 'deployed', 'in use': 'deployed', issued: 'deployed', assigned: 'deployed', active: 'deployed', 'checked out': 'deployed',
    'in repair': 'in_repair', repair: 'in_repair', maintenance: 'in_repair', 'under repair': 'in_repair', servicing: 'in_repair', faulty: 'in_repair', broken: 'in_repair',
    retired: 'retired', decommissioned: 'retired', 'end of life': 'retired', eol: 'retired', inactive: 'retired',
    recycled: 'recycled', disposed: 'recycled', scrapped: 'recycled', disposal: 'recycled', 'e waste': 'recycled', ewaste: 'recycled',
  };
  if (map[s]) return map[s];
  const underscored = s.replace(/ /g, '_');
  return STATUS_KEYS.includes(underscored) ? underscored : null;
}

export interface Item {
  id: string;
  sku: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  currency: string | null;
  location: string | null;
  owner: string | null;
  supplier: string | null;
  reorder_level: number | null;
  status: string | null;
  assigned_to: string | null;
  next_calibration: string | null;
  notes: string | null;
  created_at: string;
}

/** Days until a calibration date (negative = overdue); null if no date. */
export function daysUntil(date: string | null, today: Date): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round(ms / 86400000);
}
