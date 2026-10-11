import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLessons, getContinueLesson } from '../lib/lessons-repo.js';

function StatusIcon({ lesson }) {
  if (lesson.completed) return <span className="material-symbols-outlined text-tertiary text-sm">check_circle</span>;
  if ((lesson.maxScrollFraction || 0) > 0) return <span className="material-symbols-outlined text-primary text-sm">play_circle</span>;
  return <span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>;
}

export default function TodaysAI() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, lessons: [], current: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lessons, current] = await Promise.all([listLessons(), getContinueLesson()]);
        if (!cancelled) setState({ loading: false, error: null, lessons, current });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, lessons: [], current: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div className="p-space-lg"><p className="font-body-sm text-body-sm text-on-surface-variant">Loading\u2026</p></div>;
  if (state.error) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">Couldn't load this page</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{state.error}</p>
        </div>
      </div>
    );
  }

  const { lessons, current } = state;

  if (lessons.length === 0) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm max-w-md mx-auto">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>bolt</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">Nothing queued up yet</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Import a lesson and it'll appear here as your next mission.</p>
          <button onClick={() => navigate('/lesson-importer')} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold">Import a lesson</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-space-md lg:px-space-lg py-space-lg max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
      <div className="lg:col-span-5">
        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col gap-space-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Lesson ledger</span>
          <div className="flex flex-col gap-1 mt-space-xs">
            {lessons.map((l) => {
              const isCurrent = current && l.id === current.id;
              return (
                <button
                  key={l.id}
                  onClick={() => navigate(`/lesson-sandbox/${l.id}`)}
                  className={`w-full text-left flex items-center justify-between p-space-xs rounded transition-colors ${
                    isCurrent ? 'bg-surface-container-high shadow-sm' : 'bg-surface-container/40 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-space-sm min-w-0">
                    <StatusIcon lesson={l} />
                    <span className={`truncate ${isCurrent ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>{l.title}</span>
                  </div>
                  <span className="font-label-caps text-label-caps text-outline shrink-0">{Math.round((l.maxScrollFraction || 0) * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="lg:col-span-7">
        {current ? (
          <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md flex flex-col gap-space-sm">
            <span className="px-space-xs py-0.5 rounded bg-primary-container text-on-primary font-label-caps text-label-caps font-semibold w-fit">TODAY</span>
            <h1 className="font-headline-xl text-headline-xl text-on-surface leading-tight">{current.title}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{current.excerpt || 'No preview available.'}</p>
            <div className="flex flex-wrap gap-1.5 font-label-caps text-label-caps">
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface">{current.category}</span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface">{current.readingTimeMin} min read</span>
            </div>
            <button onClick={() => navigate(`/lesson-sandbox/${current.id}`)} className="mt-space-sm self-start px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-semibold text-body-md flex items-center gap-space-xs">
              {(current.maxScrollFraction || 0) > 0 ? 'Continue' : 'Start'} lesson
              <span className="material-symbols-outlined text-body-md">arrow_forward</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md flex flex-col gap-space-sm items-start">
            <span className="font-label-caps text-label-caps text-tertiary uppercase">All caught up</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Every lesson is complete</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Import more lessons to keep going.</p>
          </div>
        )}
      </div>
    </div>
  );
}
