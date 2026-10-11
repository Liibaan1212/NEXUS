import { useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listFlashcards, createFlashcard, deleteFlashcard, flashcardFromLesson } from '../lib/modules-repo.js';
import { listLessons } from '../lib/lessons-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Flashcards() {
  const showToast = useToast();
  const { loading, error, data, reload } = useAsyncLoad(async () => {
    const [cards, lessons] = await Promise.all([listFlashcards(), listLessons()]);
    return { cards, lessons };
  });
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    await createFlashcard({ front: front.trim(), back: back.trim() });
    setFront('');
    setBack('');
    showToast('Card created', 'success');
    reload();
  }

  return (
    <PageShell title="Flashcards" description="Create cards manually or from a lesson excerpt. Reviews persist in SQLite." loading={loading} error={error}>
      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} placeholder="Front (prompt)" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} placeholder="Back (answer)" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Add card</button>
      </form>

      {(data?.lessons || []).length > 0 && (
        <div className="rounded-xl bg-surface-container-low p-space-md">
          <p className="font-label-caps text-label-caps text-outline uppercase mb-space-sm">Generate from lesson excerpt</p>
          <div className="flex flex-col gap-1">
            {data.lessons.slice(0, 8).map((l) => (
              <button
                key={l.id}
                onClick={async () => { await flashcardFromLesson(l.id); showToast('Card from lesson', 'success'); reload(); }}
                className="text-left p-space-xs rounded bg-surface-container hover:bg-surface-container-high font-body-sm text-on-surface"
              >
                {l.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        {(data?.cards || []).map((c) => (
          <div key={c.id} className="rounded-lg bg-surface-container p-space-md">
            <div className="flex justify-between">
              <p className="font-body-sm font-semibold text-on-surface">{c.front}</p>
              <button onClick={async () => { await deleteFlashcard(c.id); reload(); }} className="text-outline hover:text-error">
                <span className="material-symbols-outlined text-body-md">delete</span>
              </button>
            </div>
            <p className="font-body-sm text-on-surface-variant mt-1">{c.back}</p>
          </div>
        ))}
      </div>
      {!data?.cards?.length && <p className="font-body-sm text-on-surface-variant">No flashcards yet.</p>}
    </PageShell>
  );
}
