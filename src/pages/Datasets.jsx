import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import {
  createDataset,
  deleteDataset,
  getDatasetSummary,
  listDatasets,
  previewDataset,
  syncDatasets,
  updateDataset,
} from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

const blankDataset = { title: '', pathOrUrl: '', format: 'csv', description: '' };
const bytes = (value = 0) => value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
const previewFormats = new Set(['csv', 'tsv', 'json', 'txt', 'css']);

const canPreview = (dataset) => Boolean(dataset.pathOrUrl?.trim()) && previewFormats.has((dataset.format || '').toLowerCase());

export default function Datasets() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { loading, error, data: datasetsData, reload } = useAsyncLoad(listDatasets);
  const { data: summaryData, reload: reloadSummary } = useAsyncLoad(getDatasetSummary);
  const datasets = datasetsData || [];
  const summary = summaryData || {};
  const [form, setForm] = useState(blankDataset);
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const formats = useMemo(() => [...new Set(datasets.map((dataset) => dataset.format || 'unknown'))].sort(), [datasets]);
  const visible = useMemo(() => datasets
    .filter((dataset) => formatFilter === 'all' || (dataset.format || 'unknown') === formatFilter)
    .filter((dataset) => `${dataset.title} ${dataset.description} ${dataset.pathOrUrl}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === 'name'
      ? a.title.localeCompare(b.title)
      : sort === 'format'
        ? (a.format || '').localeCompare(b.format || '')
        : b.createdAt - a.createdAt), [datasets, formatFilter, query, sort]);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (editing) {
      await updateDataset(editing.id, form);
      showToast('Dataset details updated', 'success');
    } else {
      await createDataset(form);
      showToast('Dataset registered', 'success');
    }
    setForm(blankDataset);
    setEditing(null);
    setShowForm(false);
    reload();
  }

  async function sync() {
    const result = await syncDatasets();
    showToast(result.added ? `${result.added} file(s) added from #Data Center` : '#Data Center is already in sync', 'success');
    reload();
    reloadSummary();
  }

  async function openPreview(dataset) {
    setPreviewError('');
    try {
      setPreview({ id: dataset.id, title: dataset.title, loading: true });
      const data = await previewDataset(dataset.id);
      setPreview({ id: dataset.id, title: dataset.title, ...data });
    } catch (err) {
      setPreview(null);
      setPreviewError(err.message);
    }
  }

  return (
    <PageShell title="Datasets Hub" description="Local dataset catalog with automatic #Data Center registration." loading={loading} error={error}>
      <section className="rounded-xl bg-surface-container-low p-space-md flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <p className="font-body-md font-semibold text-on-surface">#Data Center auto-sync is on</p>
          <p className="font-body-sm text-on-surface-variant">New files are registered automatically while NEXUS is running.</p>
        </div>
        <div className="flex flex-wrap gap-space-xs"><button onClick={() => navigate('/csv-studio')} className="dataset-action dataset-action-primary"><span className="material-symbols-outlined">auto_fix_high</span>Open CSV Studio</button><button onClick={sync} className="dataset-action"><span className="material-symbols-outlined">sync</span>Sync now</button></div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
        <Metric label="Cataloged" value={summary.total ?? datasets.length} />
        <Metric label="In Data Center" value={summary.local ?? 0} />
        <Metric label="Stored size" value={bytes(summary.totalBytes)} />
        <Metric label="Missing files" value={summary.missing ?? 0} />
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <div className="flex flex-wrap gap-space-sm items-center justify-between">
          <p className="font-body-md font-semibold text-on-surface">Dataset catalog</p>
          <button onClick={() => { setEditing(null); setForm(blankDataset); setShowForm((value) => !value); }} className="dataset-action"><span className="material-symbols-outlined">{showForm ? 'close' : 'add'}</span>{showForm ? 'Close' : 'Add dataset'}</button>
        </div>
        {showForm && <form onSubmit={save} className="flex flex-col gap-space-sm">
          <input name="title" value={form.title} onChange={change} placeholder="Dataset name" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" autoFocus />
          <input name="pathOrUrl" value={form.pathOrUrl} onChange={change} placeholder="Local path or URL" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
          <div className="flex flex-wrap gap-space-sm">
            <input name="format" value={form.format} onChange={change} placeholder="Format (csv, json, parquet)" className="flex-1 bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
            <button type="submit" className="dataset-action dataset-action-primary"><span className="material-symbols-outlined">save</span>{editing ? 'Save changes' : 'Register dataset'}</button>
          </div>
          <textarea name="description" value={form.description} onChange={change} rows={2} placeholder="Description, source, or notes" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        </form>}
      </section>

      <section className="flex flex-wrap gap-space-sm">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, description, or path" className="flex-1 min-w-48 bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm">
          <option value="all">All formats</option>{formats.map((format) => <option key={format} value={format}>{format}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm">
          <option value="newest">Newest first</option><option value="name">Name</option><option value="format">Format</option>
        </select>
      </section>

      <section className="flex flex-col gap-space-sm">
        {visible.map((dataset) => <article key={dataset.id} className="rounded-lg bg-surface-container p-space-md flex flex-wrap justify-between gap-space-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-space-xs items-center"><p className="font-body-md font-semibold text-on-surface">{dataset.title}</p><span className="rounded px-2 py-1 bg-surface-container-high font-label-caps text-label-caps text-primary">{dataset.format || 'unknown'}</span></div>
            <p className="font-label-caps text-label-caps text-outline break-all">{dataset.pathOrUrl || 'No path supplied'}</p>
            {dataset.description && <p className="font-body-sm text-on-surface-variant mt-1">{dataset.description}</p>}
          </div>
          <div className="flex gap-space-xs items-start">
            <button onClick={() => openPreview(dataset)} className="dataset-action" title={canPreview(dataset) ? `Preview ${dataset.title}` : 'Preview unavailable for this dataset'} disabled={!canPreview(dataset)}><span className="material-symbols-outlined">table_view</span><span className="dataset-action-label">Preview</span></button>
            <button onClick={() => { setEditing(dataset); setForm(dataset); setShowForm(true); }} className="dataset-action" title={`Edit ${dataset.title}`}><span className="material-symbols-outlined">edit</span><span className="dataset-action-label">Edit</span></button>
            <button onClick={async () => { await deleteDataset(dataset.id); showToast('Dataset removed from catalog', 'success'); reload(); }} className="dataset-action dataset-action-danger" title={`Remove ${dataset.title}`}><span className="material-symbols-outlined">delete</span><span className="dataset-action-label">Remove</span></button>
          </div>
          {preview?.id === dataset.id && <div className="w-full">{previewError ? <p className="font-body-sm text-error">{previewError}</p> : <Preview preview={preview} close={() => setPreview(null)} />}</div>}
        </article>)}
        {!visible.length && <p className="font-body-sm text-on-surface-variant">No datasets match these filters.</p>}
      </section>
    </PageShell>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg bg-surface-container p-space-md"><p className="font-label-caps text-label-caps text-outline">{label}</p><p className="font-headline-sm text-on-surface">{value}</p></div>;
}

function Preview({ preview, close }) {
  const rowCount = preview.rows?.length || 0;
  return <section className="dataset-preview"><div className="dataset-preview-header"><div><p className="dataset-preview-title">Preview: {preview.title}</p><p className="dataset-preview-meta">{preview.loading ? 'Preparing a local preview…' : preview.kind === 'table' ? `${rowCount} sample rows · ${preview.headers.length} columns` : 'Local file preview'}</p></div><button onClick={close} className="dataset-action dataset-action-icon" title="Close preview" aria-label="Close preview"><span className="material-symbols-outlined">close</span></button></div>
    {preview.loading ? <p className="dataset-preview-footer">Loading preview…</p> : preview.kind === 'table' ? <div className="dataset-preview-scroll"><table className="dataset-preview-table"><thead><tr>{preview.headers.map((cell, index) => <th key={index}>{cell || `Column ${index + 1}`}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} title={cell}>{cell || '—'}</td>)}</tr>)}</tbody></table></div> : <pre className="dataset-preview-code">{preview.kind === 'json' ? JSON.stringify(preview.rows, null, 2) : preview.text}</pre>}
    {preview.truncated && <p className="dataset-preview-footer">Preview limited to the first 20 KB.</p>}
  </section>;
}
