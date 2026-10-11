import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listChecklist, toggleChecklist, getAnalytics } from '../lib/modules-repo.js';

export default function JobReadiness() {
  const { loading, error, data, reload } = useAsyncLoad(async () => {
    const [items, analytics] = await Promise.all([listChecklist(), getAnalytics()]);
    return { items, analytics };
  });

  const done = data?.items?.filter((i) => i.done).length || 0;
  const total = data?.items?.length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <PageShell title="Job Readiness" description="Checklist grounded in your real learning progress." loading={loading} error={error}>
      {data && (
        <>
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <div className="flex justify-between mb-space-xs">
              <span className="font-label-caps text-label-caps text-outline uppercase">Checklist</span>
              <span className="font-label-metric text-primary">{pct}%</span>
            </div>
            <div className="w-full h-2 rounded bg-surface-container-highest overflow-hidden">
              <div className="h-full bg-primary-container" style={{ width: `${pct}%` }} />
            </div>
            <p className="font-body-sm text-on-surface-variant mt-space-sm">
              Lesson completion: {data.analytics.stats.percentComplete}% · streak {data.analytics.streak} days
            </p>
          </div>
          <div className="flex flex-col gap-space-xs">
            {data.items.map((item) => (
              <label key={item.id} className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={async (e) => { await toggleChecklist(item.id, e.target.checked); reload(); }}
                />
                <span className={`font-body-sm ${item.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{item.label}</span>
                <span className="ml-auto font-label-caps text-label-caps text-outline">{item.category}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
