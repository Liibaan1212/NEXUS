import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listConcepts } from '../lib/modules-repo.js';
import { listLessons, getStats } from '../lib/lessons-repo.js';

export default function Mastery() {
  const { loading, error, data } = useAsyncLoad(async () => {
    const [concepts, lessons, stats] = await Promise.all([listConcepts(), listLessons(), getStats()]);
    return { concepts, lessons, stats };
  });

  const categories = [...new Set((data?.lessons || []).map((l) => l.category))];

  return (
    <PageShell title="Mastery Matrix" description="Completion and concept mastery across your curriculum." loading={loading} error={error}>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-space-sm">
            <Stat label="Lessons complete" value={`${data.stats.percentComplete}%`} />
            <Stat label="Completed" value={data.stats.completed} />
            <Stat label="In progress" value={data.stats.inProgress} />
          </div>
          <div className="rounded-xl bg-surface-container-low overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="p-space-sm font-label-caps text-label-caps text-outline">Category</th>
                  <th className="p-space-sm font-label-caps text-label-caps text-outline">Lessons</th>
                  <th className="p-space-sm font-label-caps text-label-caps text-outline">Done</th>
                  <th className="p-space-sm font-label-caps text-label-caps text-outline">Avg scroll</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const rows = data.lessons.filter((l) => l.category === cat);
                  const done = rows.filter((l) => l.completed).length;
                  const avg = rows.length
                    ? Math.round((rows.reduce((s, l) => s + (l.maxScrollFraction || 0), 0) / rows.length) * 100)
                    : 0;
                  return (
                    <tr key={cat} className="border-b border-white/5">
                      <td className="p-space-sm font-body-sm text-on-surface">{cat}</td>
                      <td className="p-space-sm font-body-sm text-on-surface-variant">{rows.length}</td>
                      <td className="p-space-sm font-body-sm text-tertiary">{done}</td>
                      <td className="p-space-sm font-body-sm text-primary">{avg}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {(data.concepts || []).map((c) => (
              <div key={c.id} className="rounded-lg bg-surface-container p-space-sm">
                <div className="flex justify-between">
                  <span className="font-body-sm text-on-surface">{c.name}</span>
                  <span className="font-label-metric text-primary">{c.mastery}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-highest mt-space-xs overflow-hidden">
                  <div className="h-full bg-primary-container" style={{ width: `${c.mastery}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-md">
      <p className="font-label-caps text-label-caps text-outline uppercase">{label}</p>
      <p className="font-headline-lg text-headline-lg text-on-surface mt-1">{value}</p>
    </div>
  );
}
