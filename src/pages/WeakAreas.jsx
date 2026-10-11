import { useNavigate } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { getWeakAreas } from '../lib/modules-repo.js';

export default function WeakAreas() {
  const navigate = useNavigate();
  const { loading, error, data: weak } = useAsyncLoad(getWeakAreas);

  return (
    <PageShell title="Weak Areas" description="Incomplete lessons ranked by how little you've read them." loading={loading} error={error}>
      {!weak?.length ? (
        <p className="font-body-sm text-on-surface-variant">No weak areas — either everything is complete or you haven't imported lessons yet.</p>
      ) : (
        <div className="flex flex-col gap-space-sm">
          {weak.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/lesson-sandbox/${l.id}`)}
              className="text-left rounded-lg bg-surface-container p-space-md hover:bg-surface-container-high"
            >
              <div className="flex justify-between gap-space-sm">
                <span className="font-body-md font-semibold text-on-surface">{l.title}</span>
                <span className="font-label-metric text-error">{l.weaknessScore}</span>
              </div>
              <p className="font-label-caps text-label-caps text-outline mt-1">
                {l.category} · {Math.round((l.maxScrollFraction || 0) * 100)}% read · opened {l.openCount}×
              </p>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
