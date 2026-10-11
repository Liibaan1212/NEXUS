import { useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listResources, createResource, deleteResource } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Resources() {
  const showToast = useToast();
  const { loading, error, data: resources, reload } = useAsyncLoad(listResources);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await createResource({ title: title.trim(), url: url.trim(), notes });
    setTitle('');
    setUrl('');
    setNotes('');
    showToast('Resource saved', 'success');
    reload();
  }

  return (
    <PageShell title="Resource Library" description="Bookmarks and study links stored offline." loading={loading} error={error}>
      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (optional)" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Add resource</button>
      </form>
      <div className="flex flex-col gap-space-sm">
        {(resources || []).map((r) => (
          <div key={r.id} className="rounded-lg bg-surface-container p-space-md flex justify-between gap-space-sm">
            <div>
              <p className="font-body-md font-semibold text-on-surface">{r.title}</p>
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="font-body-sm text-primary hover:underline break-all">{r.url}</a>}
              {r.notes && <p className="font-body-sm text-on-surface-variant mt-1">{r.notes}</p>}
            </div>
            <button onClick={async () => { await deleteResource(r.id); reload(); }} className="text-outline hover:text-error shrink-0">
              <span className="material-symbols-outlined text-body-md">delete</span>
            </button>
          </div>
        ))}
        {!resources?.length && <p className="font-body-sm text-on-surface-variant">No resources yet.</p>}
      </div>
    </PageShell>
  );
}
