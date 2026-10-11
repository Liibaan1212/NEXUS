import { useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import { listCsvAudits, runCsvAudit } from '../lib/csv-repo.js';

const emptyState = { mode: 'clean', fileName: '', csvText: '', result: null, error: '', running: false };

export default function CsvStudio() {
  const inputRef = useRef(null);
  const [state, setState] = useState(emptyState);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function selectFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setState((current) => ({ ...current, error: 'Choose a CSV file so the parser can preserve its tabular structure.' }));
      return;
    }
    setState((current) => ({ ...current, fileName: file.name, csvText: '', result: null, error: '', running: true }));
    try {
      const csvText = await file.text();
      setState((current) => ({ ...current, csvText, running: false }));
    } catch {
      setState((current) => ({ ...current, running: false, error: 'The file could not be read.' }));
    }
  }

  async function analyze() {
    if (!state.csvText) return;
    setState((current) => ({ ...current, running: true, error: '' }));
    try {
      const result = await runCsvAudit(state.fileName, state.csvText, state.mode);
      setState((current) => ({ ...current, running: false, result }));
    } catch (error) {
      setState((current) => ({ ...current, running: false, error: error.message }));
    }
  }

  async function showHistory() {
    setHistoryOpen((value) => !value);
    if (!history.length) setHistory(await listCsvAudits());
  }

  function download() {
    if (!state.result?.cleanedCsv) return;
    const blob = new Blob([state.result.cleanedCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cleaned-${state.fileName || 'dataset.csv'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const result = state.result;
  const hardIssues = result?.issues.filter((issue) => issue.severity === 'error').length || 0;
  const warningIssues = result?.issues.filter((issue) => issue.severity === 'warning').length || 0;
  return (
    <PageShell title="CSV Studio" description="A deterministic cleaning and quality audit bench for messy datasets.">
      <section className="csv-studio-hero">
        <div><span className="font-label-caps text-label-caps text-primary">DATA QUALITY / LOCAL ONLY</span><h2 className="font-headline-xl text-headline-xl text-on-surface mt-2">Make every row explainable.</h2><p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-2xl">Upload any CSV, inspect what is actually wrong, then export a cleaned copy with rules inferred from that file’s own structure and values.</p></div>
        <span className="material-symbols-outlined csv-studio-hero-icon">dataset</span>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-space-md items-start">
        <div className="flex flex-col gap-space-md">
          <div className="csv-studio-panel">
            <div className="csv-studio-tabs" role="tablist" aria-label="CSV operation"><button className={state.mode === 'clean' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'clean', result: null }))}><span className="material-symbols-outlined">auto_fix_high</span>Clean & export</button><button className={state.mode === 'check' ? 'active' : ''} onClick={() => setState((current) => ({ ...current, mode: 'check', result: null }))}><span className="material-symbols-outlined">fact_check</span>Check quality</button></div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => selectFile(event.target.files[0])} />
            <button className={`csv-dropzone ${state.fileName ? 'selected' : ''}`} onClick={() => inputRef.current?.click()}><span className="material-symbols-outlined">{state.fileName ? 'task' : 'upload_file'}</span><strong>{state.fileName || 'Choose a messy CSV'}</strong><small>{state.fileName ? `${(state.csvText.length / 1024).toFixed(1)} KB loaded` : 'The file stays local to this NEXUS instance.'}</small></button>
            {state.error && <p className="csv-error"><span className="material-symbols-outlined">error</span>{state.error}</p>}
            <button onClick={analyze} disabled={!state.csvText || state.running} className="dataset-action dataset-action-primary csv-run-button"><span className="material-symbols-outlined">{state.running ? 'progress_activity' : state.mode === 'clean' ? 'auto_fix_high' : 'fact_check'}</span>{state.running ? 'Analyzing…' : state.mode === 'clean' ? 'Clean this dataset' : 'Run quality check'}</button>
          </div>
          <div className="csv-studio-panel csv-method-panel"><div className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-primary">verified</span><p className="font-body-md text-body-md font-semibold text-on-surface">Trust boundary</p></div><p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">NEXUS never fills missing values or guesses a column meaning. It reports uncertainty, preserves non-empty values, and records every run.</p></div>
        </div>
        <div className="flex flex-col gap-space-md">{result ? <AuditResult result={result} mode={state.mode} download={download} /> : <div className="csv-empty-state"><span className="material-symbols-outlined">table_chart_view</span><p className="font-body-md text-body-md text-on-surface">Your evidence panel is ready.</p><p className="font-body-sm text-body-sm text-on-surface-variant">Upload a file to see its shape, issues, and a 20-row preview.</p></div>}</div>
      </section>
      <section className="csv-history-section"><button onClick={showHistory} className="csv-history-toggle"><span><span className="material-symbols-outlined">history</span>Run history</span><span className="material-symbols-outlined">{historyOpen ? 'expand_less' : 'expand_more'}</span></button>{historyOpen && <div className="csv-history-list">{history.length ? history.map((run) => <div key={run.id} className="csv-history-row"><span className="material-symbols-outlined">{run.mode === 'clean' ? 'auto_fix_high' : 'fact_check'}</span><div><strong>{run.fileName}</strong><small>{run.mode} · {new Date(run.createdAt).toLocaleString()}</small></div><span className={`csv-status ${run.summary.issues.some((issue) => issue.severity === 'error') ? 'bad' : 'good'}`}>{run.summary.issues.filter((issue) => issue.severity === 'error').length ? 'Needs review' : 'Audited'}</span></div>) : <p className="font-body-sm text-on-surface-variant">No runs recorded yet.</p>}</div>}</section>
    </PageShell>
  );
}

function AuditResult({ result, mode, download }) {
  const hardIssues = result.issues.filter((issue) => issue.severity === 'error').length;
  const warningIssues = result.issues.filter((issue) => issue.severity === 'warning').length;
  return <div className="flex flex-col gap-space-md"><div className="csv-metrics"><Metric label="Rows kept" value={`${result.rowCount}/${result.originalRowCount}`} /><Metric label="Columns" value={result.columnCount} /><Metric label="Needs review" value={hardIssues + warningIssues} /><Metric label="Rejected rows" value={result.rejectedRowCount ?? 0} /></div><div className="csv-studio-panel"><div className="csv-result-heading"><div><span className={`csv-status ${hardIssues ? 'bad' : 'good'}`}>{hardIssues ? 'Structure needs attention' : mode === 'clean' ? 'Cleaned and audited' : 'No structural errors'}</span><h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">{result.fileName || 'Dataset result'}</h3><p className="font-body-sm text-body-sm text-on-surface-variant">Detected {result.delimiter} delimiter · {result.columns.map((column) => `${column.name}: ${column.detectedType}`).join(' · ')}</p></div>{mode === 'clean' && <button onClick={download} className="dataset-action dataset-action-primary"><span className="material-symbols-outlined">download</span>Download CSV</button>}</div><PreviewTable result={result} /></div><div className="csv-studio-panel"><h3 className="font-body-md text-body-md font-semibold text-on-surface">Value counts</h3><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Frequency profile used to detect inconsistent categories and choose the mode fill value.</p><div className="csv-value-counts">{result.columns.map((column) => <div key={column.name} className="csv-value-count"><strong>{column.name}</strong><span>{column.detectedType} · fill: {column.fillValue || 'none'}</span><div>{column.valueCounts?.slice(0, 8).map((item) => <small key={`${column.name}-${item.value}`}>{item.value || 'empty'} <b>{item.count}</b></small>)}</div></div>)}</div></div><div className="csv-studio-panel"><h3 className="font-body-md text-body-md font-semibold text-on-surface">Exact method used</h3><ol className="csv-recipe">{result.recipe.map((step) => <li key={step}><span className="material-symbols-outlined">done</span>{step}</li>)}</ol></div><div className="csv-studio-panel"><h3 className="font-body-md text-body-md font-semibold text-on-surface">Findings</h3><div className="csv-issues">{result.issues.length ? result.issues.slice(0, 40).map((issue, index) => <div key={`${issue.code}-${index}`} className={`csv-issue ${issue.severity}`}><span className="material-symbols-outlined">{issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'auto_fix_high'}</span><span>{issue.message}</span></div>) : <p className="font-body-sm text-on-surface-variant">No issues detected.</p>}</div></div></div>;
}

function PreviewTable({ result }) {
  return <div className="dataset-preview csv-result-preview"><div className="dataset-preview-header"><div><p className="dataset-preview-title">Cleaned preview</p><p className="dataset-preview-meta">First {result.rows.length} rows · original values preserved unless a rule is listed</p></div></div><div className="dataset-preview-scroll"><table className="dataset-preview-table"><thead><tr>{result.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} title={cell}>{cell || '—'}</td>)}</tr>)}</tbody></table></div></div>;
}

function Metric({ label, value }) { return <div className="csv-metric"><span>{label}</span><strong>{value}</strong></div>; }