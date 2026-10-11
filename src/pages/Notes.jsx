import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listNotes, createNote, updateNote, deleteNote } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';
import { NOTE_CACHE_KEY, readCachedNotes, mergeNotesWithCache, upsertNoteInList, removeNoteFromList, writeCachedNotes } from '../lib/note-cache.js';

const COLORS = {
  sun: { label: 'Sun', background: '#ffe28a', ink: '#513d12', accent: '#e0a629' },
  mint: { label: 'Mint', background: '#bfe9d4', ink: '#174836', accent: '#4fae83' },
  sky: { label: 'Sky', background: '#b9ddf7', ink: '#163c59', accent: '#4d9cd0' },
  rose: { label: 'Rose', background: '#f6c4c3', ink: '#5c292a', accent: '#d66e70' },
  lilac: { label: 'Lilac', background: '#d8c9f4', ink: '#3d2b5c', accent: '#9776d4' },
};

const TEMPLATES = [
  { label: 'Lesson takeaway', icon: 'lightbulb', title: 'Key takeaway', body: 'The big idea is…\n\nWhy it matters:\n\nA simple example:' },
  { label: 'Confusion log', icon: 'help', title: 'I need to revisit', body: 'What confused me:\n\nMy current guess:\n\nQuestion to resolve:' },
  { label: 'Action plan', icon: 'rocket_launch', title: 'Next action', body: 'Today I will…\n\nDefinition of done:\n\nReward:' },
];

function blankDraft() {
  return { title: '', body: '', tags: '', color: 'sun', category: 'lesson', pinned: false, remindAt: '' };
}

const DRAFT_KEY = 'nexus-notes-draft';

function readLocal(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function loadNotesWithOfflineFallback() {
  const cachedNotes = readCachedNotes(NOTE_CACHE_KEY, []);

  try {
    const notes = await listNotes();
    const merged = mergeNotesWithCache(notes, cachedNotes);
    writeCachedNotes(merged, NOTE_CACHE_KEY);
    return merged;
  } catch {
    return cachedNotes;
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function NoteCard({ note, onEdit, onDelete, onPin }) {
  const palette = COLORS[note.color] || COLORS.sun;
  return (
    <article className="note-card" style={{ '--note-bg': palette.background, '--note-ink': palette.ink, '--note-accent': palette.accent }}>
      <span className="note-card-pin" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="note-card-category">{note.category === 'lesson' ? 'Lesson note' : note.category}</span>
          <h3 className="note-card-title">{note.title}</h3>
        </div>
        <button type="button" onClick={() => onPin(note)} className={`note-icon-button ${note.pinned ? 'active' : ''}`} title={note.pinned ? 'Unpin note' : 'Pin to home'} aria-label={note.pinned ? 'Unpin note' : 'Pin to home'}>
          <span className="material-symbols-outlined">push_pin</span>
        </button>
      </div>
      <p className="note-card-body">{note.body || 'A blank page is still a beginning.'}</p>
      <div className="note-card-footer">
        <div className="flex min-w-0 flex-wrap gap-1">
          {(note.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag} className="note-tag">#{tag}</span>)}
          {note.remindAt && <span className="note-tag"><span className="material-symbols-outlined">alarm</span>{formatDate(note.remindAt)}</span>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => onEdit(note)} className="note-icon-button" title="Edit note" aria-label="Edit note"><span className="material-symbols-outlined">edit</span></button>
          <button type="button" onClick={() => onDelete(note)} className="note-icon-button" title="Delete note" aria-label="Delete note"><span className="material-symbols-outlined">delete</span></button>
        </div>
      </div>
    </article>
  );
}

export default function Notes() {
  const showToast = useToast();
  const { confirm } = useDialog();
  const { loading, error, data: notes, reload } = useAsyncLoad(loadNotesWithOfflineFallback);
  const [draft, setDraft] = useState(() => readLocal(DRAFT_KEY, blankDraft()));
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const localVisibleNotes = useMemo(() => {
    const cacheNotes = readCachedNotes(NOTE_CACHE_KEY, []);
    return mergeNotesWithCache(notes || [], cacheNotes);
  }, [notes]);

  const visibleNotes = useMemo(() => localVisibleNotes.filter((note) => {
    const haystack = `${note.title} ${note.body} ${note.tags}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase().trim());
    const matchesFilter = filter === 'all' || (filter === 'pinned' ? note.pinned : note.category === filter);
    return matchesQuery && matchesFilter;
  }), [notes, query, filter]);

  function resetEditor() { setDraft(blankDraft()); setEditing(null); }

  async function handleSave(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;

    const payload = {
      ...draft,
      title: draft.title.trim(),
      body: draft.body.trim(),
      remindAt: draft.remindAt ? new Date(`${draft.remindAt}T09:00:00`).getTime() : null,
    };

    try {
      if (editing) {
        await updateNote(editing, payload);
        showToast('Note refreshed', 'success');
      } else {
        const created = await createNote(payload);
        const record = created && typeof created === 'object' ? created : { ...payload, id: `offline-${Date.now()}` };
        writeCachedNotes(upsertNoteInList(readCachedNotes(NOTE_CACHE_KEY, []), record), NOTE_CACHE_KEY);
        showToast('Note pinned to your memory board', 'success');
      }
    } catch {
      const localNote = { ...payload, id: editing || `offline-${Date.now()}`, createdAt: editing ? Date.now() : Date.now(), updatedAt: Date.now() };
      const nextCached = editing
        ? upsertNoteInList(readCachedNotes(NOTE_CACHE_KEY, []), { ...localNote, id: editing })
        : upsertNoteInList(readCachedNotes(NOTE_CACHE_KEY, []), localNote);
      writeCachedNotes(nextCached, NOTE_CACHE_KEY);
      showToast('Saved on this device. It will stay in your notes until the server reconnects.', 'success');
    }

    resetEditor();
    reload();
  }

  function startEdit(note) {
    setEditing(note.id);
    setDraft({ ...note, remindAt: note.remindAt ? new Date(note.remindAt).toISOString().slice(0, 10) : '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function togglePin(note) {
    const nextPinned = !note.pinned;
    try {
      await updateNote(note.id, { pinned: nextPinned });
      const cached = readCachedNotes(NOTE_CACHE_KEY, []);
      writeCachedNotes(upsertNoteInList(cached, { ...note, pinned: nextPinned, updatedAt: Date.now() }), NOTE_CACHE_KEY);
      showToast(nextPinned ? 'Pinned to Home' : 'Removed from Home', 'success');
    } catch {
      const cached = readCachedNotes(NOTE_CACHE_KEY, []);
      const updated = upsertNoteInList(cached, { ...note, pinned: nextPinned, updatedAt: Date.now() });
      writeCachedNotes(updated, NOTE_CACHE_KEY);
      showToast('Pinned locally. Your note is safe even while the server is offline.', 'success');
    }
    reload();
  }

  async function removeNote(note) {
    const confirmed = await confirm({
      title: 'Delete this memory?',
      message: `“${note.title}” will be removed from your notes board. This action cannot be undone.`,
      confirmLabel: 'Delete memory',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });

    if (!confirmed) return;

    const cached = readCachedNotes(NOTE_CACHE_KEY, []);
    const nextCache = removeNoteFromList(cached, note.id);
    writeCachedNotes(nextCache, NOTE_CACHE_KEY);

    try {
      await deleteNote(note.id);
      showToast('Note deleted', 'success');
    } catch {
      showToast('Deleted locally. It will stay removed even while the server is unavailable.', 'success');
    }
    reload();
  }

  return (
    <PageShell
      title="Notes Manager"
      description="Turn every lesson insight into a visual memory cue."
      loading={loading}
      error={error}
      actions={(
        <Link to="/videos" className="notes-video-link notes-video-link-header" title="Return to Journey Videos" aria-label="Return to Journey Videos">
          <span className="material-symbols-outlined">video_library</span>
          <span>Journey Videos</span>
          <span className="material-symbols-outlined notes-video-link-arrow">arrow_forward</span>
        </Link>
      )}
    >
      <div className="notes-hero">
        <div>
          <span className="notes-eyebrow"><span className="material-symbols-outlined">neurology</span> Your second brain</span>
          <h2>Catch the thought<br /><em>before it disappears.</em></h2>
          <p>Write it. Shape it. See it again when your brain needs the spark.</p>
        </div>
        <div className="notes-hero-mark"><span className="material-symbols-outlined">sticky_note_2</span><small>{notes?.length || 0} memories</small></div>
      </div>

      <form onSubmit={handleSave} className="notes-composer">
        <div className="notes-composer-heading"><div><span className="notes-eyebrow">{editing ? 'Editing a memory' : 'Capture a new memory'}</span><h3>{editing ? 'Make it clearer.' : 'What do you want to remember?'}</h3></div><span className="material-symbols-outlined notes-compose-icon">edit_note</span></div>
        <div className="grid gap-3 md:grid-cols-[1fr_170px]">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Give your idea a memorable title…" className="notes-title-input" autoFocus={!!editing} />
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="notes-select"><option value="lesson">Lesson note</option><option value="idea">Bright idea</option><option value="question">Question</option><option value="action">Action plan</option></select>
        </div>
        <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={5} placeholder="Explain it in your own words. The act of rewriting is where the learning sticks…" className="notes-body-input" />
        <div className="notes-toolbar">
          <div className="flex flex-wrap items-center gap-2"><span className="notes-toolbar-label">Mood</span>{Object.entries(COLORS).map(([key, palette]) => <button key={key} type="button" onClick={() => setDraft({ ...draft, color: key })} className={`notes-color-swatch ${draft.color === key ? 'selected' : ''}`} style={{ background: palette.background }} title={palette.label} aria-label={`${palette.label} note color`} />)}</div>
          <label className="notes-inline-field"><span className="material-symbols-outlined">sell</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="tags, comma separated" /></label>
          <label className="notes-inline-field"><span className="material-symbols-outlined">alarm</span><input type="date" value={draft.remindAt} onChange={(event) => setDraft({ ...draft, remindAt: event.target.value })} /></label>
          <label className="notes-pin-toggle"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} /><span className="material-symbols-outlined">push_pin</span> Show on Home</label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{TEMPLATES.map((template) => <button key={template.label} type="button" onClick={() => setDraft({ ...draft, title: template.title, body: template.body })} className="notes-template"><span className="material-symbols-outlined">{template.icon}</span>{template.label}</button>)}</div><div className="flex gap-2"><button type="button" onClick={resetEditor} className="notes-secondary-button">{editing ? 'Cancel' : 'Clear'}</button><button type="submit" disabled={!draft.title.trim()} className="notes-primary-button"><span className="material-symbols-outlined">{editing ? 'save' : 'add'}</span>{editing ? 'Update note' : 'Save memory'}</button></div></div>
      </form>

      <section className="notes-board-header"><div><span className="notes-eyebrow">Memory board</span><h2>Your notes, made visible.</h2></div><div className="notes-stats"><span><strong>{notes?.length || 0}</strong> total</span><span><strong>{notes?.filter((note) => note.pinned).length || 0}</strong> on Home</span><span><strong>{notes?.filter((note) => note.category === 'lesson').length || 0}</strong> lessons</span></div></section>
      <div className="notes-filters"><label className="notes-search"><span className="material-symbols-outlined">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your memory board…" /></label><div className="notes-filter-pills">{[['all', 'All notes'], ['pinned', 'On Home'], ['lesson', 'Lessons'], ['idea', 'Ideas'], ['question', 'Questions']].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={filter === key ? 'active' : ''}>{label}</button>)}</div></div>
      <div className="notes-grid">{visibleNotes.map((note) => <NoteCard key={note.id} note={note} onEdit={startEdit} onDelete={removeNote} onPin={togglePin} />)}</div>
      {!visibleNotes.length && <div className="notes-empty"><span className="material-symbols-outlined">auto_awesome</span><h3>{notes?.length ? 'Nothing matches that search.' : 'Your board is ready for its first thought.'}</h3><p>Save one small idea from a lesson. Small ideas become a powerful map.</p></div>}
    </PageShell>
  );
}
