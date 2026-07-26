'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Boxes, ListChecks, CalendarClock, FileUp, BarChart3,
  Warehouse, Search, Download, Plus, Pencil, Trash2, X, PackageOpen,
  Upload, Sheet, Recycle,
} from 'lucide-react';
import { Item, STATUSES, STATUS_LABEL, STATUS_TONE, daysUntil } from '@/lib/itam';

type View = 'dashboard' | 'inventory' | 'catalog' | 'calibration' | 'ingest' | 'reporting';

const NAV: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'inventory', label: 'Inventory', icon: <Boxes size={18} /> },
  { key: 'catalog', label: 'Catalog', icon: <ListChecks size={18} /> },
  { key: 'calibration', label: 'Calibration', icon: <CalendarClock size={18} /> },
  { key: 'ingest', label: 'Import', icon: <FileUp size={18} /> },
  { key: 'reporting', label: 'Reporting', icon: <BarChart3 size={18} /> },
];
const VIEW_META: Record<View, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Asset lifecycle at a glance.' },
  inventory: { title: 'Inventory', sub: 'Every asset — add, edit, move status, export.' },
  catalog: { title: 'Catalog', sub: 'Assets grouped by type — stock vs. field.' },
  calibration: { title: 'Calibration', sub: 'Upcoming and overdue calibration.' },
  ingest: { title: 'Import', sub: 'Bring data in from a file or Google Sheet.' },
  reporting: { title: 'Reporting', sub: 'Distribution, value, and recycling.' },
};

const FORM_FIELDS = ['name', 'sku', 'category', 'status', 'quantity', 'unit', 'unit_price', 'currency', 'location', 'owner', 'supplier', 'assigned_to', 'reorder_level', 'next_calibration', 'notes'] as const;

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function StatusBadge({ status }: { status: string | null }) {
  const s = status || 'in_stock';
  return <span className={`status-badge ${STATUS_TONE[s] || 'stock'}`}>{STATUS_LABEL[s] || s}</span>;
}

/* ── Add / Edit drawer ─────────────────────────────────────────────────────── */
function ItemDrawer({
  item, onClose, onSaved, categories, owners, locations, showToast,
}: {
  item: Partial<Item> | null;
  onClose: () => void;
  onSaved: () => void;
  categories: string[];
  owners: string[];
  locations: string[];
  showToast: (m: string) => void;
}) {
  const isNew = !item?.id;
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const k of FORM_FIELDS) {
      const v = (item as Record<string, unknown> | null)?.[k];
      f[k] = v == null ? '' : String(v);
    }
    if (!f.status) f.status = 'in_stock';
    if (!f.currency) f.currency = 'USD';
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setBusy(true); setError('');
    const url = isNew ? '/api/items' : `/api/items/${item!.id}`;
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { showToast(isNew ? 'Asset added.' : 'Asset updated.'); onSaved(); }
      else { setError(d.error || 'Save failed.'); setBusy(false); }
    } catch {
      setError('Network error.'); setBusy(false);
    }
  }

  const list = (id: string, opts: string[]) => (
    <datalist id={id}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
  );

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <form className="glass drawer" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="drawer-head">
          <h2>{isNew ? 'Add asset' : 'Edit asset'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="form-grid">
            <label className="fw"><span>Name *</span><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Dell Latitude 5440" required /></label>
            <label><span>Asset tag / SKU</span><input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="MH-LT-100" /></label>
            <label><span>Category</span><input list="dl-cat" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Laptops" />{list('dl-cat', categories)}</label>
            <label><span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label><span>Quantity</span><input type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="0" /></label>
            <label><span>Unit</span><input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="each" /></label>
            <label><span>Unit price</span><input type="number" step="0.01" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} placeholder="0.00" /></label>
            <label><span>Currency</span><input value={form.currency} onChange={(e) => set('currency', e.target.value)} placeholder="USD" /></label>
            <label><span>Warehouse</span><input list="dl-loc" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Warehouse North" />{list('dl-loc', locations)}</label>
            <label><span>Customer</span><input list="dl-own" value={form.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Meridian Health" />{list('dl-own', owners)}</label>
            <label><span>Assigned to</span><input value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} placeholder="Anita Engineer" /></label>
            <label><span>Supplier</span><input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="Dell" /></label>
            <label><span>Reorder level</span><input type="number" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} placeholder="0" /></label>
            <label><span>Next calibration</span><input type="date" value={form.next_calibration} onChange={(e) => set('next_calibration', e.target.value)} /></label>
            <label className="fw"><span>Notes</span><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Serial numbers, condition, PO reference…" /></label>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
        </div>
        <div className="drawer-foot">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={busy}>{busy ? <span className="spinner" /> : null}{isNew ? 'Add asset' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [drawer, setDrawer] = useState<Partial<Item> | null | 'closed'>('closed');
  const [toast, setToast] = useState('');
  // ingest state
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [result, setResult] = useState<{ ok?: boolean; error?: string; rowsIngested?: number; usedLlm?: boolean; columnMapping?: Record<string, string | null> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory?limit=1000');
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      setItems(data.items ?? []);
      setConfigured(data.configured ?? null);
    } catch { /* ignore */ }
  }, [router]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const owners = useMemo(() => [...new Set(items.map((i) => i.owner).filter(Boolean))].sort() as string[], [items]);
  const locations = useMemo(() => [...new Set(items.map((i) => i.location).filter(Boolean))].sort() as string[], [items]);
  const categoryNames = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort() as string[], [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category && (it.category || 'Uncategorized') !== category) return false;
      if (status && (it.status || 'in_stock') !== status) return false;
      if (owner && it.owner !== owner) return false;
      if (location && it.location !== location) return false;
      if (!q) return true;
      return [it.sku, it.name, it.category, it.location, it.owner, it.supplier, it.assigned_to]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [items, query, owner, location, category, status]);

  // KPIs
  const kpi = useMemo(() => {
    const byStatus: Record<string, number> = {};
    let units = 0, value = 0, low = 0;
    for (const it of items) {
      const s = it.status || 'in_stock';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      units += it.quantity ?? 0;
      if (it.quantity != null && it.unit_price != null) value += it.quantity * it.unit_price;
      const isLow = it.quantity === 0 || (it.reorder_level != null && it.quantity != null && it.quantity <= it.reorder_level);
      if (isLow) low += 1;
    }
    return { byStatus, units, value, low };
  }, [items]);

  const today = useMemo(() => new Date(), []);
  const calItems = useMemo(() => {
    return items
      .map((it) => ({ it, d: daysUntil(it.next_calibration, today) }))
      .filter((x) => x.d != null)
      .sort((a, b) => (a.d as number) - (b.d as number));
  }, [items, today]);
  const calDueSoon = calItems.filter((x) => (x.d as number) <= 30).length;

  const hasFilter = Boolean(query || owner || location || category || status);

  function exportCsv() {
    const cols: (keyof Item)[] = ['sku', 'name', 'category', 'status', 'quantity', 'unit', 'unit_price', 'currency', 'location', 'owner', 'assigned_to', 'supplier', 'next_calibration'];
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(','), ...filtered.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const tag = [category, status, owner, location].filter(Boolean).join('-').replace(/\s+/g, '_') || 'all';
    a.href = url; a.download = `assets-${tag}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function changeStatus(id: string, newStatus: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it))); // optimistic
    const res = await fetch(`/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) showToast(`Moved to ${STATUS_LABEL[newStatus]}.`); else { showToast('Update failed.'); loadInventory(); }
  }

  async function deleteItem(it: Item) {
    if (!window.confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/items/${it.id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Asset deleted.'); loadInventory(); } else showToast('Delete failed.');
  }

  async function logout() { await fetch('/api/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }

  async function ingestFile(file: File) {
    setBusy(true); setResult(null);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/ingest', { method: 'POST', body: form });
      setResult(await res.json());
    } catch (e) { setResult({ error: e instanceof Error ? e.message : 'Upload failed.' }); }
    finally { setBusy(false); loadInventory(); }
  }
  async function ingestSheet() {
    if (!sheetUrl.trim()) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch('/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetUrl: sheetUrl.trim() }) });
      setResult(await res.json());
    } catch (e) { setResult({ error: e instanceof Error ? e.message : 'Ingest failed.' }); }
    finally { setBusy(false); loadInventory(); }
  }

  const meta = VIEW_META[view];

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark"><Warehouse size={20} strokeWidth={1.8} /></span>
          <div className="brand-text"><strong>TechLabs</strong><span>Asset Manager</span></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item${view === n.key ? ' active' : ''}`} onClick={() => setView(n.key)}>
              {n.icon}<span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="pill">{items.length} assets</span>
          {kpi.low > 0 && <span className="pill warn">{kpi.low} low</span>}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="main">
        <header className="main-header">
          <div className="mh-title"><h1>{meta.title}</h1><p>{meta.sub}</p></div>
          <div className="mh-user">
            <div className="who"><strong>Admin</strong><span>Administrator</span></div>
            <span className="avatar">AD</span>
            <button className="ghost-btn" onClick={logout}>Sign out</button>
          </div>
        </header>

        <div className="main-body">
          {configured === false ? (
            <div className="glass empty"><div className="empty-icon"><PackageOpen size={26} /></div>Database isn’t configured yet. Add your keys and run the SQL in <code>supabase/schema.sql</code>.</div>
          ) : (
            <>
              {/* ── Dashboard ── */}
              {view === 'dashboard' && (
                <>
                  <div className="stat-grid">
                    <div className="glass stat-card"><div className="stat-value">{items.length}</div><div className="stat-label">Total assets</div><div className="stat-sub">{kpi.units} units</div></div>
                    <div className="glass stat-card"><div className="stat-value">{kpi.byStatus.in_stock ?? 0}</div><div className="stat-label">In stock</div></div>
                    <div className="glass stat-card"><div className="stat-value">{kpi.byStatus.deployed ?? 0}</div><div className="stat-label">Deployed</div></div>
                    <div className="glass stat-card"><div className="stat-value">{kpi.byStatus.in_repair ?? 0}</div><div className="stat-label">In repair</div></div>
                    <div className="glass stat-card"><div className="stat-value">USD {money(kpi.value)}</div><div className="stat-label">Stock value</div></div>
                    <div className={`glass stat-card${calDueSoon ? ' warn' : ''}`}><div className="stat-value">{calDueSoon}</div><div className="stat-label">Calibration due</div><div className="stat-sub">next 30 days</div></div>
                    <div className={`glass stat-card${kpi.low ? ' warn' : ''}`}><div className="stat-value">{kpi.low}</div><div className="stat-label">Low / out of stock</div></div>
                    <div className="glass stat-card"><div className="stat-value">{(kpi.byStatus.retired ?? 0) + (kpi.byStatus.recycled ?? 0)}</div><div className="stat-label">Retired / recycled</div></div>
                  </div>

                  <div className="section-title">Lifecycle</div>
                  <div className="glass bars">
                    {STATUSES.map((s) => {
                      const n = kpi.byStatus[s.key] ?? 0;
                      const pct = items.length ? Math.round((n / items.length) * 100) : 0;
                      return (
                        <div className="bar-row" key={s.key}>
                          <span className="bar-label"><StatusBadge status={s.key} /></span>
                          <span className="bar-track"><span className={`bar-fill ${s.tone}`} style={{ width: `${pct}%` }} /></span>
                          <span className="bar-val">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Inventory ── */}
              {view === 'inventory' && (
                <>
                  <div className="toolbar glass">
                    <div className="search"><span className="search-icon"><Search size={18} /></span>
                      <input type="text" placeholder="Search asset, tag, customer, assignee…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
                    </div>
                    <div className="filters">
                      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                        <option value="">All types</option>
                        {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Customer">
                        <option value="">All customers</option>
                        {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Warehouse">
                        <option value="">All warehouses</option>
                        {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button className="export-btn" onClick={exportCsv} disabled={!filtered.length}><Download size={16} />Export{hasFilter ? ' filtered' : ''}</button>
                      <button className="primary-btn slim" onClick={() => setDrawer(null)}><Plus size={16} />Add asset</button>
                    </div>
                  </div>

                  <div className="section-title">{status ? STATUS_LABEL[status] : 'All assets'}
                    <span className="count">{hasFilter ? `· ${filtered.length} of ${items.length}` : `· ${items.length}`}</span>
                    {hasFilter && <button className="clear-btn" onClick={() => { setQuery(''); setOwner(''); setLocation(''); setCategory(''); setStatus(''); }}>Clear</button>}
                  </div>

                  {items.length === 0 ? (
                    <div className="glass empty"><div className="empty-icon"><PackageOpen size={26} /></div>No assets yet — add one or import a file.</div>
                  ) : filtered.length === 0 ? (
                    <div className="glass empty"><div className="empty-icon"><Search size={26} /></div>No assets match your filters.</div>
                  ) : (
                    <div className="glass table-wrap">
                      <div className="table-scroll">
                        <table>
                          <thead><tr>
                            <th>Tag</th><th>Asset</th><th>Type</th><th>Status</th><th style={{ textAlign: 'right' }}>Qty</th><th>Warehouse</th><th>Customer</th><th>Assigned</th><th></th>
                          </tr></thead>
                          <tbody>
                            {filtered.map((it) => (
                              <tr key={it.id}>
                                <td className="mono-cell">{it.sku ?? <span className="dash">—</span>}</td>
                                <td className="strong">{it.name ?? <span className="dash">—</span>}</td>
                                <td>{it.category ? <span className="pill">{it.category}</span> : <span className="dash">—</span>}</td>
                                <td>
                                  <select className={`status-select ${STATUS_TONE[it.status || 'in_stock']}`} value={it.status || 'in_stock'} onChange={(e) => changeStatus(it.id, e.target.value)} aria-label="Change status">
                                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                  </select>
                                </td>
                                <td className={`num${it.quantity === 0 ? ' qty-zero' : ''}`}>{it.quantity ?? <span className="dash">—</span>}</td>
                                <td>{it.location ?? <span className="dash">—</span>}</td>
                                <td>{it.owner ? <span className="pill owner">{it.owner}</span> : <span className="dash">—</span>}</td>
                                <td>{it.assigned_to ?? <span className="dash">—</span>}</td>
                                <td className="row-actions">
                                  <button className="icon-btn" onClick={() => setDrawer(it)} aria-label="Edit"><Pencil size={15} /></button>
                                  <button className="icon-btn danger" onClick={() => deleteItem(it)} aria-label="Delete"><Trash2 size={15} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Catalog ── */}
              {view === 'catalog' && <Catalog items={items} onPick={(c) => { setCategory(c); setView('inventory'); }} />}

              {/* ── Calibration ── */}
              {view === 'calibration' && (
                <>
                  <div className="section-title">Calibration schedule<span className="count">· {calItems.length} tracked</span></div>
                  {calItems.length === 0 ? (
                    <div className="glass empty"><div className="empty-icon"><CalendarClock size={26} /></div>No calibration dates set. Add one when you edit an asset.</div>
                  ) : (
                    <div className="glass table-wrap"><div className="table-scroll">
                      <table>
                        <thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Warehouse</th><th>Next calibration</th><th>Due</th><th></th></tr></thead>
                        <tbody>
                          {calItems.map(({ it, d }) => (
                            <tr key={it.id}>
                              <td className="strong">{it.name}</td>
                              <td>{it.category ? <span className="pill">{it.category}</span> : <span className="dash">—</span>}</td>
                              <td><StatusBadge status={it.status} /></td>
                              <td>{it.location ?? <span className="dash">—</span>}</td>
                              <td className="mono-cell">{it.next_calibration}</td>
                              <td>{(d as number) < 0 ? <span className="due overdue">{Math.abs(d as number)}d overdue</span> : (d as number) <= 30 ? <span className="due soon">in {d}d</span> : <span className="due ok">in {d}d</span>}</td>
                              <td className="row-actions"><button className="icon-btn" onClick={() => setDrawer(it)} aria-label="Edit"><Pencil size={15} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div></div>
                  )}
                </>
              )}

              {/* ── Import ── */}
              {view === 'ingest' && (
                <>
                  <div className="grid">
                    <div className="card glass">
                      <div className="card-head"><span className="card-icon"><Upload size={18} /></span><h2>Upload a file</h2></div>
                      <p className="hint">Any layout — the agent maps the columns.</p>
                      <div className={`dropzone${dragging ? ' drag' : ''}`} role="button" tabIndex={0}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) ingestFile(f); }}
                        onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}>
                        <strong>Click to choose</strong> or drag a file here<span className="dz-formats">CSV · TSV · XLSX · JSON</span>
                      </div>
                      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = ''; }} />
                    </div>
                    <div className="card glass">
                      <div className="card-head"><span className="card-icon"><Sheet size={18} /></span><h2>Google Sheet link</h2></div>
                      <p className="hint">Share as “Anyone with the link — Viewer”.</p>
                      <label className="field-label" htmlFor="sheet-url">Sheet URL</label>
                      <input id="sheet-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ingestSheet(); }} />
                      <button className="primary-btn" onClick={ingestSheet} disabled={busy || !sheetUrl.trim()}>{busy ? <span className="spinner" /> : null}Ingest sheet</button>
                    </div>
                  </div>
                  {busy && !result && <div className="msg ok glass"><span className="spinner" /> &nbsp;Normalizing and ingesting…</div>}
                  {result && (
                    <div className={`msg glass ${result.error && !result.rowsIngested ? 'err' : 'ok'}`} role="status" aria-live="polite">
                      {result.ok ? (<>Ingested <strong>{result.rowsIngested}</strong> rows. {result.usedLlm ? 'Haiku mapped unrecognized columns.' : 'All columns matched by rules.'}
                        {result.columnMapping && <div className="mapping">{Object.entries(result.columnMapping).map(([s, d]) => <div key={s}>{s} → {d ? <code>{d}</code> : <span className="drop">dropped</span>}</div>)}</div>}
                      </>) : (<>Error: {result.error}</>)}
                    </div>
                  )}
                </>
              )}

              {/* ── Reporting ── */}
              {view === 'reporting' && <Reporting items={items} kpi={kpi} />}
            </>
          )}
        </div>
      </main>

      {drawer !== 'closed' && (
        <ItemDrawer item={drawer} onClose={() => setDrawer('closed')} onSaved={() => { setDrawer('closed'); loadInventory(); }} categories={categoryNames} owners={owners} locations={locations} showToast={showToast} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ── Catalog view ──────────────────────────────────────────────────────────── */
function Catalog({ items, onPick }: { items: Item[]; onPick: (c: string) => void }) {
  const rows = useMemo(() => {
    const map = new Map<string, { count: number; inStock: number; deployed: number; repair: number; nextCal: string | null }>();
    for (const it of items) {
      const c = it.category || 'Uncategorized';
      const e = map.get(c) ?? { count: 0, inStock: 0, deployed: 0, repair: 0, nextCal: null };
      e.count += 1;
      const s = it.status || 'in_stock';
      if (s === 'in_stock') e.inStock += it.quantity ?? 0;
      if (s === 'deployed') e.deployed += 1;
      if (s === 'in_repair') e.repair += 1;
      if (it.next_calibration && (!e.nextCal || it.next_calibration < e.nextCal)) e.nextCal = it.next_calibration;
      map.set(c, e);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
  }, [items]);

  if (!items.length) return <div className="glass empty"><div className="empty-icon"><ListChecks size={26} /></div>No assets yet.</div>;
  return (
    <div className="glass table-wrap"><div className="table-scroll">
      <table>
        <thead><tr><th>Asset type</th><th style={{ textAlign: 'right' }}>Items</th><th style={{ textAlign: 'right' }}>In stock</th><th style={{ textAlign: 'right' }}>In field</th><th style={{ textAlign: 'right' }}>In repair</th><th>Next cal</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="clickable" onClick={() => onPick(r.name)}>
              <td className="strong">{r.name}</td>
              <td className="num">{r.count}</td>
              <td className="num">{r.inStock}</td>
              <td className="num">{r.deployed}</td>
              <td className={`num${r.repair ? ' qty-zero' : ''}`}>{r.repair}</td>
              <td className="mono-cell">{r.nextCal ?? <span className="dash">—</span>}</td>
              <td className="dash">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div></div>
  );
}

/* ── Reporting view ────────────────────────────────────────────────────────── */
function Reporting({ items, kpi }: { items: Item[]; kpi: { byStatus: Record<string, number>; units: number; value: number; low: number } }) {
  const byOwner = useMemo(() => tally(items, (i) => i.owner), [items]);
  const byWarehouse = useMemo(() => tally(items, (i) => i.location), [items]);
  const recycled = useMemo(() => items.filter((i) => i.status === 'recycled' || i.status === 'retired'), [items]);

  return (
    <>
      <div className="stat-grid">
        <div className="glass stat-card"><div className="stat-value">{items.length}</div><div className="stat-label">Total assets</div></div>
        <div className="glass stat-card"><div className="stat-value">USD {money(kpi.value)}</div><div className="stat-label">Stock value</div></div>
        <div className="glass stat-card"><div className="stat-value">{byOwner.length}</div><div className="stat-label">Customers</div></div>
        <div className="glass stat-card"><div className="stat-value">{byWarehouse.length}</div><div className="stat-label">Warehouses</div></div>
      </div>
      <div className="report-cols">
        <div className="glass report-card">
          <div className="section-title tight">By customer</div>
          {byOwner.length ? byOwner.map(([name, n]) => <MiniBar key={name} label={name} n={n} max={byOwner[0][1]} />) : <p className="hint">No customer data.</p>}
        </div>
        <div className="glass report-card">
          <div className="section-title tight">By warehouse</div>
          {byWarehouse.length ? byWarehouse.map(([name, n]) => <MiniBar key={name} label={name} n={n} max={byWarehouse[0][1]} />) : <p className="hint">No warehouse data.</p>}
        </div>
      </div>
      <div className="section-title"><Recycle size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Retired &amp; recycled<span className="count">· {recycled.length}</span></div>
      {recycled.length ? (
        <div className="glass table-wrap"><div className="table-scroll">
          <table>
            <thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Customer</th><th>Warehouse</th></tr></thead>
            <tbody>{recycled.map((it) => (
              <tr key={it.id}><td className="strong">{it.name}</td><td>{it.category ? <span className="pill">{it.category}</span> : <span className="dash">—</span>}</td><td><StatusBadge status={it.status} /></td><td>{it.owner ?? <span className="dash">—</span>}</td><td>{it.location ?? <span className="dash">—</span>}</td></tr>
            ))}</tbody>
          </table>
        </div></div>
      ) : <div className="glass empty"><div className="empty-icon"><Recycle size={26} /></div>Nothing retired or recycled yet.</div>}
    </>
  );
}

function tally(items: Item[], key: (i: Item) => string | null): [string, number][] {
  const map = new Map<string, number>();
  for (const it of items) { const k = key(it); if (k) map.set(k, (map.get(k) ?? 0) + 1); }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
function MiniBar({ label, n, max }: { label: string; n: number; max: number }) {
  return (
    <div className="bar-row">
      <span className="bar-label plain">{label}</span>
      <span className="bar-track"><span className="bar-fill deployed" style={{ width: `${max ? (n / max) * 100 : 0}%` }} /></span>
      <span className="bar-val">{n}</span>
    </div>
  );
}
