import { useEffect, useState } from 'react';

export default function CreateFolderDialog({ open, location, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for your folder.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate(name.trim());
      onClose();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-folder-title" className="w-full max-w-md rounded-3xl border border-white/15 bg-surface-container-low p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-[26px] text-primary">create_new_folder</span>
          <div>
            <h2 id="create-folder-title" className="text-xl font-semibold text-on-surface">Create a folder</h2>
            <p className="mt-1 text-sm leading-5 text-on-surface-variant">A new folder will be created directly inside {location}.</p>
          </div>
        </div>
        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="new-folder-name">Folder name</label>
        <input
          id="new-folder-name"
          autoFocus
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Machine learning"
          className="mt-2 w-full rounded-xl border border-white/15 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {error && <p className="mt-2 text-sm text-error" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-60">
            <span className="material-symbols-outlined text-[18px]">create_new_folder</span>{saving ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </form>
    </div>
  );
}
