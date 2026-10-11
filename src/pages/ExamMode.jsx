import { useMemo, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listInterview } from '../lib/modules-repo.js';

export default function ExamMode() {
  const { loading, error, data: questions } = useAsyncLoad(listInterview);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [timerId, setTimerId] = useState(null);

  const q = questions?.[index];

  function start() {
    setStarted(true);
    setIndex(0);
    setRevealed(false);
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    setTimerId(id);
  }

  function stop() {
    if (timerId) clearInterval(timerId);
    setTimerId(null);
    setStarted(false);
  }

  const timeLabel = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [seconds]);

  return (
    <PageShell title="Exam Mode" description="Timed local interview drill using your offline question bank." loading={loading} error={error}>
      {!started ? (
        <div className="rounded-xl bg-surface-container-low p-space-lg flex flex-col gap-space-sm">
          <p className="font-body-sm text-on-surface-variant">
            {questions?.length || 0} questions ready. Timer runs locally — nothing leaves this machine.
          </p>
          <button
            disabled={!questions?.length}
            onClick={start}
            className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm disabled:opacity-50"
          >
            Start exam
          </button>
        </div>
      ) : q ? (
        <div className="rounded-xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
          <div className="flex justify-between">
            <span className="font-label-caps text-label-caps text-outline">Q {index + 1} / {questions.length}</span>
            <span className="font-label-metric text-primary">{timeLabel}</span>
          </div>
          <p className="font-headline-sm text-headline-sm text-on-surface">{q.question}</p>
          <p className="font-label-caps text-label-caps text-outline">{q.category} · {q.difficulty}</p>
          {revealed && <p className="font-body-sm text-on-surface-variant whitespace-pre-wrap">{q.answer}</p>}
          <div className="flex flex-wrap gap-space-sm">
            <button onClick={() => setRevealed(true)} className="px-space-md py-space-sm rounded bg-surface-container-high text-on-surface font-body-sm">Reveal answer</button>
            <button
              onClick={() => { setIndex(Math.min(index + 1, questions.length - 1)); setRevealed(false); }}
              className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm"
            >
              Next
            </button>
            <button onClick={stop} className="px-space-md py-space-sm rounded bg-error/20 text-error font-body-sm">End</button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
