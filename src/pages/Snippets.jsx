import { useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listSnippets, createSnippet, deleteSnippet } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Snippets() {
  const showToast = useToast();
  const { loading, error, data: snippets, reload } = useAsyncLoad(listSnippets);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await createSnippet({ title: title.trim(), language, code });
    setTitle('');
    setCode('');
    showToast('Snippet saved', 'success');
    reload();
  }

  return (
    <PageShell title="Code Snippets" description="Personal snippet library stored in SQLite." loading={loading} error={error}>
      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="flex-1 bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language" className="sm:w-40 bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        </div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={5} placeholder="Code…" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-code-block text-code-block focus:outline-none resize-y" />
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Save snippet</button>
      </form>
      <div className="flex flex-col gap-space-sm">
        {(snippets || []).map((s) => (
          <div key={s.id} className="rounded-lg bg-surface-container p-space-md">
            <div className="flex justify-between mb-space-xs">
              <div>
                <p className="font-body-md font-semibold text-on-surface">{s.title}</p>
                <span className="font-label-caps text-label-caps text-outline">{s.language}</span>
              </div>
              <button onClick={async () => { await deleteSnippet(s.id); reload(); }} className="text-outline hover:text-error">
                <span className="material-symbols-outlined text-body-md">delete</span>
              </button>
            </div>
            <pre className="font-code-block text-code-block text-on-surface-variant whitespace-pre-wrap overflow-auto max-h-48">{s.code}</pre>
          </div>
        ))}
        {!snippets?.length && <p className="font-body-sm text-on-surface-variant">No snippets yet.</p>}
      </div>
    </PageShell>
  );
}
