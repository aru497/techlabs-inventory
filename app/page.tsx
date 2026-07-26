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

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    <div className="wrap">
      <header>
        <h1>TechLabs Inventory</h1>
        <p>
          Drop a spreadsheet or paste a Google Sheet link. An agent normalizes any column layout
          into one inventory schema, then ingests it into Supabase.
        </p>
      </header>

      <div className="grid">
        {/* File upload */}
        <div className="card">
          <h2>Upload a file</h2>
          <p className="hint">CSV, TSV, XLSX, or JSON.</p>
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <strong>Click to choose</strong> or drag a file here
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
        <div className="card">
          <h2>Google Sheet link</h2>
          <p className="hint">Set sharing to “Anyone with the link — Viewer”.</p>
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
          <button onClick={ingestSheet} disabled={busy || !sheetUrl.trim()}>
            {busy ? <span className="spinner" /> : null}
            Ingest sheet
          </button>
        </div>
      </div>

      {busy && !result && (
        <div className="msg">
          <span className="spinner" /> Normalizing and ingesting…
        </div>
      )}

      {result && (
        <div className={`msg ${result.error && !result.rowsIngested ? 'err' : 'ok'}`}>
          {result.ok ? (
            <>
              Ingested <strong>{result.rowsIngested}</strong> rows.{' '}
              {result.usedLlm ? 'The agent used Haiku to map unrecognized columns.' : 'All columns matched by rules.'}
              {result.columnMapping && (
                <div className="mapping">
                  {Object.entries(result.columnMapping).map(([src, dst]) => (
                    <div key={src}>
                      {src} → <code>{dst ?? 'dropped'}</code>
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

      <div className="section-title">
        Inventory {items.length ? `· ${items.length} items` : ''}
      </div>

      {configured === false ? (
        <div className="empty">
          Supabase isn’t configured yet. Add your keys to <code>.env.local</code> and run the SQL in{' '}
          <code>supabase/schema.sql</code>.
        </div>
      ) : items.length === 0 ? (
        <div className="empty">No items yet — ingest a file or sheet to get started.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Location</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.sku ?? '—'}</td>
                  <td>{it.name ?? '—'}</td>
                  <td>{it.category ? <span className="pill">{it.category}</span> : '—'}</td>
                  <td>{it.quantity ?? '—'}</td>
                  <td>{it.unit ?? '—'}</td>
                  <td>
                    {it.unit_price != null
                      ? `${it.currency ? it.currency + ' ' : ''}${it.unit_price}`
                      : '—'}
                  </td>
                  <td>{it.location ?? '—'}</td>
                  <td>{it.supplier ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
