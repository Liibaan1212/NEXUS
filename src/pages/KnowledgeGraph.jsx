import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listConcepts } from '../lib/modules-repo.js';
import { listLessons } from '../lib/lessons-repo.js';

export default function KnowledgeGraph() {
  const navigate = useNavigate();
  const { loading, error, data } = useAsyncLoad(async () => {
    const [concepts, lessons] = await Promise.all([listConcepts(), listLessons()]);
    return { concepts, lessons };
  });
  const [selectedId, setSelectedId] = useState(null);

  const graph = useMemo(() => {
    if (!data) return { concepts: [], lessons: [], width: 860, height: 330 };
    const lessonMap = Object.fromEntries(data.lessons.map((l) => [l.id, l]));
    const concepts = data.concepts.map((concept, index) => ({
      ...concept,
      x: 170,
      y: 90 + index * 150,
      lessons: (concept.lessonIds || []).map((id) => lessonMap[id]).filter(Boolean),
    }));
    const linkedIds = new Set(concepts.flatMap((concept) => concept.lessons.map((lesson) => lesson.id)));
    const lessons = data.lessons
      .filter((lesson) => linkedIds.has(lesson.id))
      .map((lesson, index) => ({
        ...lesson,
        x: 510 + (index % 2) * 260,
        y: 70 + Math.floor(index / 2) * 115,
      }));
    return { concepts, lessons, width: 860, height: Math.max(330, Math.ceil(lessons.length / 2) * 115 + 80) };
  }, [data]);

  return (
    <PageShell
      title="Knowledge Graph"
      description="See how your lessons connect to the concepts you are building."
      loading={loading}
      error={error}
      actions={
        <button onClick={() => navigate('/lessons')} className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-body-sm font-semibold flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-body-md">menu_book</span>
          Browse lessons
        </button>
      }
    >
      {!graph?.concepts.length ? (
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 42 }}>hub</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">Your graph is ready for its first concept</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">Import a categorized lesson or create a concept in Knowledge Concepts. Every linked lesson will appear here automatically.</p>
          <button onClick={() => navigate('/knowledge')} className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-body-sm font-semibold">Create a concept</button>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
            <GraphStat label="Concepts" value={graph.concepts.length} icon="hub" />
            <GraphStat label="Connected lessons" value={graph.lessons.length} icon="menu_book" />
            <GraphStat label="Avg mastery" value={`${Math.round(graph.concepts.reduce((sum, concept) => sum + concept.mastery, 0) / graph.concepts.length)}%`} icon="insights" />
            <GraphStat label="Edges" value={graph.concepts.reduce((sum, concept) => sum + concept.lessons.length, 0)} icon="account_tree" />
          </div>
          <div className="rounded-xl bg-surface-container-low p-space-sm sm:p-space-md">
            <div className="flex items-center justify-between gap-space-sm mb-space-sm">
              <div>
                <p className="font-body-md font-semibold text-on-surface">Curriculum map</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Select a node to inspect it. Lesson nodes open the full lesson.</p>
              </div>
              <div className="hidden sm:flex items-center gap-space-sm font-label-caps text-label-caps text-outline">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-primary" /> Concept</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-tertiary" /> Lesson</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="w-full min-w-[720px] h-[360px] sm:h-[460px]" role="img" aria-label="Interactive map of concepts and lessons">
                {graph.concepts.flatMap((concept) => concept.lessons.map((lesson) => {
                  const target = graph.lessons.find((item) => item.id === lesson.id);
                  const active = selectedId === concept.id || selectedId === lesson.id;
                  return target ? <line key={`${concept.id}-${lesson.id}`} x1={concept.x + 22} y1={concept.y} x2={target.x - 110} y2={target.y} stroke={active ? '#ff6b2b' : '#665d68'} strokeWidth={active ? 3 : 1.5} opacity={active ? 1 : 0.65} /> : null;
                }))}
                {graph.concepts.map((concept) => (
                  <g key={concept.id} transform={`translate(${concept.x}, ${concept.y})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(concept.id)} role="button" aria-label={`Select ${concept.name}`}>
                    <circle r="25" fill={selectedId === concept.id ? '#ff6b2b' : '#8f4b2f'} opacity="0.95" />
                    <text y="4" textAnchor="middle" fill="#fff7f4" fontSize="12" fontWeight="700">{concept.mastery}%</text>
                    <text y="48" textAnchor="middle" fill="#e1e2eb" fontSize="13" fontWeight="600">{concept.name.slice(0, 22)}</text>
                    <text y="65" textAnchor="middle" fill="#a9a2ad" fontSize="10">{concept.lessons.length} linked lessons</text>
                  </g>
                ))}
                {graph.lessons.map((lesson) => (
                  <g key={lesson.id} transform={`translate(${lesson.x}, ${lesson.y})`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/lesson-sandbox/${lesson.id}`)} role="button" aria-label={`Open ${lesson.title}`}>
                    <rect x="-110" y="-27" width="220" height="54" rx="10" fill={selectedId === lesson.id ? '#244e48' : '#263036'} stroke={selectedId === lesson.id ? '#70d3bc' : '#46515a'} strokeWidth="1.5" />
                    <text y="-3" textAnchor="middle" fill="#f4f0f4" fontSize="12" fontWeight="600">{lesson.title.slice(0, 28)}</text>
                    <text y="16" textAnchor="middle" fill="#70d3bc" fontSize="10">{lesson.completed ? 'Completed' : `${Math.round((lesson.maxScrollFraction || 0) * 100)}% read`} · {lesson.readingTimeMin} min</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {graph.concepts.map((concept) => (
              <button key={concept.id} onClick={() => setSelectedId(concept.id)} className={`text-left rounded-xl p-space-md transition-colors ${selectedId === concept.id ? 'bg-primary-container/20 ring-1 ring-primary' : 'bg-surface-container hover:bg-surface-container-high'}`}>
                <div className="flex justify-between gap-space-sm">
                  <span className="font-body-md font-semibold text-on-surface">{concept.name}</span>
                  <span className="font-label-metric text-primary">{concept.mastery}%</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">{concept.description || 'No description yet.'}</p>
                <div className="w-full h-1.5 rounded-full bg-surface-container-highest mt-space-sm overflow-hidden"><div className="h-full bg-primary-container" style={{ width: `${concept.mastery}%` }} /></div>
                <p className="font-label-caps text-label-caps text-outline mt-space-xs">{concept.lessons.length} connected lessons</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function GraphStat({ label, value, icon }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-sm">
      <span className="material-symbols-outlined text-primary text-headline-sm">{icon}</span>
      <p className="font-headline-sm text-headline-sm text-on-surface mt-1">{value}</p>
      <p className="font-label-caps text-label-caps text-outline">{label}</p>
    </div>
  );
}
