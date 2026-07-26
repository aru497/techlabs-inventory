'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Sheet, Search, Download, PackageOpen, LayoutGrid, Tag } from 'lucide-react';

interface InventoryRow {
  id: string;
  sku: string | null;
  name: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  currency: string | null;
  location: string | null;
  owner: string | null;
  supplier: string | null;
  created_at: string;
}

interface IngestResult {
  ok?: boolean;
  error?: string;
  rowsIngested?: number;
  usedLlm?: boolean;
  columnMapping?: Record<string, string | null>;
}

/* ── Icons (Lucide, consistent 1.7 stroke) ─────────────────────────────────── */
const STROKE = 1.7;
const IconUpload = () => <Upload size={18} strokeWidth={STROKE} />;
const IconSheet = () => <Sheet size={18} strokeWidth={STROKE} />;
const IconSearch = () => <Search size={18} strokeWidth={STROKE} />;
const IconExport = () => <Download size={16} strokeWidth={STROKE} />;
const IconBox = () => <PackageOpen size={26} strokeWidth={1.5} />;
const IconGrid = () => <LayoutGrid size={22} strokeWidth={STROKE} />;
const IconType = () => <Tag size={20} strokeWidth={STROKE} />;

function toCsv(rows: InventoryRow[]): string {
  const cols: (keyof InventoryRow)[] = ['sku', 'name', 'category', 'quantity', 'unit', 'unit_price', 'currency', 'location', 'owner', 'supplier'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return `${head}\n${body}`;
}

export default function Home() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory?limit=500');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setConfigured(data.configured ?? null);
    } catch {
      /* ignore */
    }
  }, [router]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.reveal');
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, configured]);

  const owners = useMemo(
    () => [...new Set(items.map((i) => i.owner).filter(Boolean))].sort() as string[],
    [items],
  );
  const locations = useMemo(
    () => [...new Set(items.map((i) => i.location).filter(Boolean))].sort() as string[],
    [items],
  );

  // Asset types with counts, total units, and low-stock signal.
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; qty: number; low: number }>();
    for (const it of items) {
      const c = it.category || 'Uncategorized';
      const e = map.get(c) ?? { count: 0, qty: 0, low: 0 };
      e.count += 1;
      e.qty += it.quantity ?? 0;
      if (it.quantity === 0) e.low += 1;
      map.set(c, e);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
  }, [items]);

  const totals = useMemo(() => {
    let qty = 0, low = 0;
    for (const it of items) { qty += it.quantity ?? 0; if (it.quantity === 0) low += 1; }
    return { qty, low };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category && (it.category || 'Uncategorized') !== category) return false;
      if (owner && it.owner !== owner) return false;
      if (location && it.location !== location) return false;
      if (!q) return true;
      return [it.sku, it.name, it.category, it.location, it.owner, it.supplier]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [items, query, owner, location, category]);

  const hasFilter = Boolean(query || owner || location || category);

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const tag = [category, owner, location].filter(Boolean).join('-').replace(/\s+/g, '_') || 'all';
    a.href = url;
    a.download = `inventory-${tag}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  async function ingestFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ingest', { method: 'POST', body: form });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setBusy(false);
      loadInventory();
    }
  }

  async function ingestSheet() {
    if (!sheetUrl.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Ingest failed.' });
    } finally {
      setBusy(false);
      loadInventory();
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  }

  return (
    <div className="wrap" ref={rootRef}>
      <header className="topbar reveal">
        <div>
          <p className="eyebrow"><span className="status-dot" aria-hidden="true" />TechLabs · Inventory</p>
          <h1>Find any asset<br />in <em>seconds</em>.</h1>
        </div>
        <button className="ghost-btn" onClick={logout}>Sign out</button>
      </header>
      <p className="lede reveal">
        Search across every warehouse, filter to one customer, and export exactly what you
        need — no pulling the whole database. Works on your phone.
      </p>

      {/* ── Upload ──────────────────────────────────────────────────────────── */}
      <div className="grid">
        <div className="card glass reveal">
          <div className="card-head">
            <span className="card-icon"><IconUpload /></span>
            <h2>Upload a file</h2>
          </div>
          <p className="hint">Any layout — the agent figures out the columns.</p>
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
          >
            <strong>Click to choose</strong> or drag a file here
            <span className="dz-formats">CSV · TSV · XLSX · JSON</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = ''; }}
          />
        </div>

        <div className="card glass reveal">
          <div className="card-head">
            <span className="card-icon"><IconSheet /></span>
            <h2>Google Sheet link</h2>
          </div>
          <p className="hint">Share as “Anyone with the link — Viewer”.</p>
          <label className="field-label" htmlFor="sheet-url">Sheet URL</label>
          <input
            id="sheet-url"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ingestSheet(); }}
          />
          <button onClick={ingestSheet} disabled={busy || !sheetUrl.trim()}>
            {busy ? <span className="spinner" /> : null}Ingest sheet
          </button>
        </div>
      </div>

      {busy && !result && (
        <div className="msg ok glass" role="status" aria-live="polite"><span className="spinner" /> &nbsp;Normalizing and ingesting…</div>
      )}
      {result && (
        <div className={`msg glass ${result.error && !result.rowsIngested ? 'err' : 'ok'}`} role="status" aria-live="polite">
          {result.ok ? (
            <>
              Ingested <strong>{result.rowsIngested}</strong> rows.{' '}
              {result.usedLlm ? 'The agent used Haiku to map unrecognized columns.' : 'All columns matched by rules — no LLM needed.'}
              {result.columnMapping && (
                <div className="mapping">
                  {Object.entries(result.columnMapping).map(([src, dst]) => (
                    <div key={src}>{src} → {dst ? <code>{dst}</code> : <span className="drop">dropped</span>}</div>
                  ))}
                </div>
              )}
            </>
          ) : (<>Error: {result.error}</>)}
        </div>
      )}

      {/* ── Step 1: choose an asset type ────────────────────────────────────── */}
      {items.length > 0 && (
        <>
          <div className="section-title reveal">Choose an asset type</div>
          <div className="type-grid reveal">
            <button
              className={`type-card${category === '' ? ' active' : ''}`}
              onClick={() => setCategory('')}
              aria-pressed={category === ''}
            >
              {totals.low > 0 && <span className="low-dot" title={`${totals.low} out of stock`} aria-hidden="true" />}
              <span className="type-icon"><IconGrid /></span>
              <span className="type-name">All items</span>
              <span className="type-meta">{items.length} items · {totals.qty} units</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                className={`type-card${category === c.name ? ' active' : ''}`}
                onClick={() => setCategory((v) => (v === c.name ? '' : c.name))}
                aria-pressed={category === c.name}
              >
                {c.low > 0 && <span className="low-dot" title={`${c.low} out of stock`} aria-hidden="true" />}
                <span className="type-icon"><IconType /></span>
                <span className="type-name">{c.name}</span>
                <span className="type-meta">{c.count} items · {c.qty} units</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Step 2: search / filter / export within the chosen type ─────────── */}
      {items.length > 0 && (
        <div className="toolbar glass reveal">
          <div className="search">
            <span className="search-icon"><IconSearch /></span>
            <input
              type="text"
              placeholder={category ? `Search within ${category}…` : 'Search SKU, name, category, warehouse, customer…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search inventory"
            />
          </div>
          <div className="filters">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by customer">
              <option value="">All customers</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Filter by warehouse">
              <option value="">All warehouses</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className="export-btn" onClick={exportCsv} disabled={!filtered.length}>
              <IconExport />Export{hasFilter ? ' filtered' : ''} CSV
            </button>
          </div>
        </div>
      )}

      <div className="section-title reveal">
        {category || 'Inventory'}
        <span className="count">
          {hasFilter ? `· ${filtered.length} of ${items.length}` : items.length ? `· ${items.length} items` : ''}
        </span>
        {hasFilter && <button className="clear-btn" onClick={() => { setQuery(''); setOwner(''); setLocation(''); setCategory(''); }}>Clear</button>}
      </div>

      {configured === false ? (
        <div className="glass empty reveal">
          <div className="empty-icon"><IconBox /></div>
          Database isn’t configured yet. Add your keys and run the SQL in <code>supabase/schema.sql</code>.
        </div>
      ) : items.length === 0 ? (
        <div className="glass empty reveal">
          <div className="empty-icon"><IconBox /></div>
          No items yet — ingest a file or sheet to get started.
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass empty reveal">
          <div className="empty-icon"><IconSearch /></div>
          No items match your search or filters.
        </div>
      ) : (
        <div className="glass table-wrap reveal">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Name</th><th>Category</th>
                  <th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Warehouse</th><th>Customer</th><th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td className="mono-cell">{it.sku ?? <span className="dash">—</span>}</td>
                    <td className="strong">{it.name ?? <span className="dash">—</span>}</td>
                    <td>{it.category ? <span className="pill">{it.category}</span> : <span className="dash">—</span>}</td>
                    <td className={`num${it.quantity === 0 ? ' qty-zero' : ''}`}>{it.quantity ?? <span className="dash">—</span>}</td>
                    <td>{it.unit ?? <span className="dash">—</span>}</td>
                    <td className="num">{it.unit_price != null ? `${it.currency ? it.currency + ' ' : ''}${it.unit_price}` : <span className="dash">—</span>}</td>
                    <td>{it.location ?? <span className="dash">—</span>}</td>
                    <td>{it.owner ? <span className="pill owner">{it.owner}</span> : <span className="dash">—</span>}</td>
                    <td>{it.supplier ?? <span className="dash">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
