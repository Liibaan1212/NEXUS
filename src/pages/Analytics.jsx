import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { getAnalytics } from '../lib/modules-repo.js';

export default function Analytics() {
  const { loading, error, data } = useAsyncLoad(getAnalytics);

  return (
    <PageShell title="Telemetry & Analytics" description="Real stats from your local SQLite database — not decorative." loading={loading} error={error}>
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
            <Tile label="Lessons" value={data.stats.total} />
            <Tile label="Completed" value={data.stats.completed} />
            <Tile label="Streak" value={`${data.streak}d`} />
            <Tile label="DB size" value={`${(data.storageBytes / 1024).toFixed(1)} KB`} />
          </div>
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">By category</h2>
            <div className="flex flex-col gap-space-xs">
              {Object.entries(data.byCategory || {}).map(([cat, v]) => (
                <div key={cat} className="flex items-center justify-between gap-space-sm">
                  <span className="font-body-sm text-on-surface">{cat}</span>
                  <span className="font-label-caps text-label-caps text-outline">{v.completed}/{v.total}</span>
                </div>
              ))}
              {!Object.keys(data.byCategory || {}).length && (
                <p className="font-body-sm text-on-surface-variant">No category data yet.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Recent activity</h2>
            {(data.activity || []).length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">Open a lesson to start logging activity days.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {data.activity.map((a) => (
                  <div key={a.day} className="flex justify-between font-body-sm">
                    <span className="text-on-surface">{a.day}</span>
                    <span className="text-on-surface-variant">{a.opens} opens · ~{a.minutes_estimate} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Total words across lessons: {data.totalWords.toLocaleString()} · total opens: {data.totalOpens}
          </p>
        </>
      )}
    </PageShell>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-md">
      <p className="font-label-caps text-label-caps text-outline uppercase">{label}</p>
      <p className="font-headline-lg text-on-surface mt-1">{value}</p>
    </div>
  );
}
