import { useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listDebug, createDebug, updateDebug, deleteDebug } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function DebugCenter() {
  const showToast = useToast();
  const { loading, error, data: issues, reload } = useAsyncLoad(listDebug);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await createDebug({ title: title.trim(), description });
    setTitle('');
    setDescription('');
    showToast('Issue logged', 'success');
    reload();
  }

  return (
    <PageShell title="Debug Center" description="Track learning/debug issues offline until you resolve them." loading={loading} error={error}>
      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue title" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What broke / what you tried" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Log issue</button>
      </form>
      <div className="flex flex-col gap-space-sm">
        {(issues || []).map((issue) => (
          <div key={issue.id} className="rounded-lg bg-surface-container p-space-md flex flex-col gap-space-xs">
            <div className="flex justify-between gap-space-sm">
              <p className="font-body-md font-semibold text-on-surface">{issue.title}</p>
              <div className="flex gap-1 items-center">
                <select
                  value={issue.status}
                  onChange={async (e) => { await updateDebug(issue.id, { status: e.target.value }); reload(); }}
                  className="bg-surface-container-high px-2 py-1 rounded font-label-caps text-label-caps text-on-surface"
                >
                  <option value="open">open</option>
                  <option value="investigating">investigating</option>
                  <option value="resolved">resolved</option>
                </select>
                <button onClick={async () => { await deleteDebug(issue.id); reload(); }} className="text-outline hover:text-error">
                  <span className="material-symbols-outlined text-body-md">delete</span>
                </button>
              </div>
            </div>
            <p className="font-body-sm text-on-surface-variant">{issue.description || 'No details'}</p>
          </div>
        ))}
        {!issues?.length && <p className="font-body-sm text-on-surface-variant">No open issues. Nice.</p>}
      </div>
    </PageShell>
  );
}
