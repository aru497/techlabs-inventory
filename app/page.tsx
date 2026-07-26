'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  supplier: string | null;
  created_at: string;
}

interface IngestResult {
  ok?: boolean;
  error?: string;
  rowsIngested?: number;
  usedLlm?: boolean;
  columnMapping?: Record<string, string | null>;
  preview?: unknown[];
}

/* ── Inline icons (consistent 1.6 stroke, no icon library / emoji) ─────────── */
function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
function IconSheet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 9h17M3.5 14.5h17M9 9v11.5M15 9v11.5" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  );
}

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory?limit=200');
      const data = await res.json();
      setItems(data.items ?? []);
      setConfigured(data.configured ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Scroll-entry reveal — IntersectionObserver, not scroll listeners.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.reveal');
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, configured]);

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
      <header className="reveal">
        <p className="eyebrow">
          <span className="status-dot" aria-hidden="true" />
          TechLabs · Inventory
        </p>
        <h1>
          Ingest anything.<br />
          One <em>clean</em> schema.
        </h1>
        <p className="lede">
          Drop a spreadsheet or paste a Google Sheet link. A normalization agent maps any
          column layout onto a single inventory schema, then writes it straight to your database.
        </p>
      </header>

      <div className="grid">
        {/* File upload */}
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
          >
            <strong>Click to choose</strong> or drag a file here
            <span className="dz-formats">CSV · TSV · XLSX · JSON</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingestFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Google Sheet */}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') ingestSheet();
            }}
          />
          <button onClick={ingestSheet} disabled={busy || !sheetUrl.trim()}>
            {busy ? <span className="spinner" /> : null}
            Ingest sheet
          </button>
        </div>
      </div>

      {busy && !result && (
        <div className="msg ok glass" role="status" aria-live="polite">
          <span className="spinner" /> &nbsp;Normalizing and ingesting…
        </div>
      )}

      {result && (
        <div className={`msg glass ${result.error && !result.rowsIngested ? 'err' : 'ok'}`} role="status" aria-live="polite">
          {result.ok ? (
            <>
              Ingested <strong>{result.rowsIngested}</strong> rows.{' '}
              {result.usedLlm
                ? 'The agent used Haiku to map unrecognized columns.'
                : 'All columns matched by rules — no LLM needed.'}
              {result.columnMapping && (
                <div className="mapping">
                  {Object.entries(result.columnMapping).map(([src, dst]) => (
                    <div key={src}>
                      {src} → {dst ? <code>{dst}</code> : <span className="drop">dropped</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>Error: {result.error}</>
          )}
        </div>
      )}

      <div className="section-title reveal">
        Inventory {items.length ? <span className="count">· {items.length} items</span> : null}
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
      ) : (
        <div className="glass table-wrap reveal">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Location</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="mono-cell">{it.sku ?? <span className="dash">—</span>}</td>
                    <td className="strong">{it.name ?? <span className="dash">—</span>}</td>
                    <td>{it.category ? <span className="pill">{it.category}</span> : <span className="dash">—</span>}</td>
                    <td className={`num${it.quantity === 0 ? ' qty-zero' : ''}`}>
                      {it.quantity ?? <span className="dash">—</span>}
                    </td>
                    <td>{it.unit ?? <span className="dash">—</span>}</td>
                    <td className="num">
                      {it.unit_price != null
                        ? `${it.currency ? it.currency + ' ' : ''}${it.unit_price}`
                        : <span className="dash">—</span>}
                    </td>
                    <td>{it.location ?? <span className="dash">—</span>}</td>
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
