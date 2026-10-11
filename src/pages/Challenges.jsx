import { useMemo, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listLessons } from '../lib/lessons-repo.js';

/** Self-check challenges derived from real imported lessons (offline). */
export default function Challenges() {
  const { loading, error, data: lessons } = useAsyncLoad(listLessons);
  const pool = useMemo(() => (lessons || []).filter((l) => l.excerpt), [lessons]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState('');

  const challenge = pool[index % Math.max(pool.length, 1)];

  function check() {
    if (!challenge) return;
    const words = challenge.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const hit = words.some((w) => guess.toLowerCase().includes(w));
    setFeedback(hit
      ? `Close enough — this excerpt is from “${challenge.title}”.`
      : `Not quite. Hint: category is ${challenge.category}.`);
  }

  return (
    <PageShell title="Arena Challenges" description="Recall challenges built from your own lesson excerpts — no fake content." loading={loading} error={error}>
      {!pool.length ? (
        <p className="font-body-sm text-on-surface-variant">Import lessons with readable text to unlock challenges.</p>
      ) : (
        <div className="rounded-xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
          <span className="font-label-caps text-label-caps text-primary uppercase">Challenge {index + 1}</span>
          <p className="font-body-md text-on-surface">{challenge.excerpt}</p>
          <p className="font-body-sm text-on-surface-variant">Which lesson is this from?</p>
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="bg-surface-container px-space-sm py-space-sm rounded-lg text-on-surface font-body-sm focus:outline-none"
            placeholder="Type the title (or part of it)"
          />
          <div className="flex gap-space-sm">
            <button onClick={check} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Check</button>
            <button
              onClick={() => { setIndex(index + 1); setGuess(''); setFeedback(''); }}
              className="px-space-md py-space-sm rounded bg-surface-container-high text-on-surface font-body-sm"
            >
              Next
            </button>
          </div>
          {feedback && <p className="font-body-sm text-tertiary">{feedback}</p>}
        </div>
      )}
    </PageShell>
  );
}
