import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listConcepts, createConcept, updateConcept, deleteConcept } from '../lib/modules-repo.js';
import { listLessons } from '../lib/lessons-repo.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';

export default function Knowledge() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { confirm } = useDialog();
  const { loading, error, data, reload } = useAsyncLoad(async () => {
    const [concepts, lessons] = await Promise.all([listConcepts(), listLessons()]);
    return { concepts, lessons };
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');

  const concepts = data?.concepts || [];
  const lessonsById = useMemo(() => Object.fromEntries((data?.lessons || []).map((lesson) => [lesson.id, lesson])), [data]);
  const visibleConcepts = concepts.filter((concept) => `${concept.name} ${concept.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Give the concept a name first', 'error');
      return;
    }
    try {
      await createConcept({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      showToast('Concept added', 'success');
      reload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function setMastery(id, mastery) {
    try {
      await updateConcept(id, { mastery });
      reload();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <PageShell title="Knowledge Concepts" description="Your personal map of ideas, mastery, and the lessons that build each skill." loading={loading} error={error} actions={<button onClick={() => navigate('/knowledge-graph')} className="px-space-md py-space-sm rounded-lg bg-surface-container text-on-surface font-body-sm font-semibold flex items-center gap-space-xs"><span className="material-symbols-outlined text-body-md">hub</span>Open graph</button>}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-space-md items-start">
        <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
          <div>
            <p className="font-body-md font-semibold text-on-surface">Add a concept</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Create a skill that you want to track independently of a lesson category.</p>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gradient descent" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should you be able to explain or do?" rows="3" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y" />
          <button type="submit" className="self-start px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-semibold text-body-sm">Add concept</button>
        </form>
        <div className="rounded-xl bg-surface-container-low p-space-md">
          <div className="flex items-center justify-between gap-space-sm">
            <div>
              <p className="font-body-md font-semibold text-on-surface">Your concept map</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{concepts.length} concepts · {data?.lessons.length || 0} lessons</p>
            </div>
            <div className="flex items-center gap-1.5 px-space-sm py-space-xs rounded-lg bg-surface-container">
              <span className="material-symbols-outlined text-on-surface-variant text-body-md">search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter concepts" className="w-28 sm:w-40 bg-transparent text-on-surface font-body-sm focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {!concepts.length ? (
        <p className="font-body-sm text-on-surface-variant">No concepts yet. Import a categorized lesson or add one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {visibleConcepts.map((c) => (
            <div key={c.id} className="rounded-lg bg-surface-container p-space-md flex flex-col gap-space-xs">
              <div className="flex justify-between gap-space-sm">
                <span className="font-body-md font-semibold text-on-surface">{c.name}</span>
                <button onClick={async () => { const confirmed = await confirm({ title: 'Delete this concept?', message: `"${c.name}" will be removed, but its lessons will stay safe.`, confirmLabel: 'Delete concept', tone: 'danger' }); if (!confirmed) return; try { await deleteConcept(c.id); reload(); showToast('Concept deleted', 'success'); } catch (err) { showToast(err.message, 'error'); } }} className="text-outline hover:text-error" title="Delete concept">
                  <span className="material-symbols-outlined text-body-md">delete</span>
                </button>
              </div>
              <p className="font-body-sm text-on-surface-variant">{c.description || 'No description'}</p>
              <div className="flex justify-between items-center mt-space-xs">
                <label className="font-label-caps text-label-caps text-on-surface-variant">Mastery</label>
                <span className="font-label-metric text-primary">{c.mastery}%</span>
              </div>
              <input aria-label={`${c.name} mastery`} type="range" min="0" max="100" value={c.mastery} onChange={(e) => setMastery(c.id, Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex flex-wrap gap-1.5 mt-space-xs">
                {(c.lessonIds || []).slice(0, 4).map((lessonId) => lessonsById[lessonId] ? (
                  <button key={lessonId} onClick={() => navigate(`/lesson-sandbox/${lessonId}`)} className="px-2 py-1 rounded bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps truncate max-w-full">{lessonsById[lessonId].title}</button>
                ) : null)}
                {!c.lessonIds?.length && <span className="font-label-caps text-label-caps text-outline">No lessons linked yet</span>}
                {(c.lessonIds?.length || 0) > 4 && <span className="font-label-caps text-label-caps text-outline self-center">+{c.lessonIds.length - 4} more</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {concepts.length > 0 && visibleConcepts.length === 0 && <p className="font-body-sm text-on-surface-variant">No concepts match “{query}”.</p>}
    </PageShell>
  );
}
