import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listLessons } from '../lib/lessons-repo.js';
import { formatRelativeTime } from '../lib/utils.js';

function StatusBadge({ lesson }) {
  if (lesson.completed) {
    return (
      <span className="flex items-center gap-1 font-label-caps text-label-caps text-tertiary">
        <span className="material-symbols-outlined text-sm">check_circle</span>Completed
      </span>
    );
  }
  if ((lesson.maxScrollFraction || 0) > 0) {
    return (
      <span className="flex items-center gap-1 font-label-caps text-label-caps text-primary">
        <span className="material-symbols-outlined text-sm">play_circle</span>In progress
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 font-label-caps text-label-caps text-outline">
      <span className="material-symbols-outlined text-sm">radio_button_unchecked</span>Not started
    </span>
  );
}

export default function Journey() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, lessons: [] });

  useEffect(() => {
    let cancelled = false;
    listLessons()
      .then((lessons) => !cancelled && setState({ loading: false, error: null, lessons }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, lessons: [] }));
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <div className="p-space-lg"><p className="font-body-sm text-body-sm text-on-surface-variant">Loading your journey\u2026</p></div>;
  if (state.error) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">Couldn't load your journey</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{state.error}</p>
        </div>
      </div>
    );
  }

  if (state.lessons.length === 0) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm max-w-md mx-auto">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>fork_right</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">Your journey starts with your first lesson</p>
          <button onClick={() => navigate('/lesson-importer')} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold">Import a lesson</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-space-md lg:px-space-lg py-space-lg max-w-2xl mx-auto flex flex-col gap-space-md">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">My Journey</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Every lesson you've imported, in the order you added them.</p>
      </div>
      <div>
        {state.lessons.map((lesson, index) => (
          <div key={lesson.id} className="flex gap-space-sm">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${lesson.completed ? 'bg-tertiary' : (lesson.maxScrollFraction || 0) > 0 ? 'bg-primary' : 'bg-surface-container-highest'}`} />
              <span className="w-px flex-1 bg-surface-container-highest" />
            </div>
            <button
              onClick={() => navigate(`/lesson-sandbox/${lesson.id}`)}
              className="flex-1 text-left mb-space-sm p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-start justify-between gap-space-sm">
                <div className="min-w-0">
                  <span className="font-label-caps text-label-caps text-outline">#{index + 1} \u2022 {lesson.category}</span>
                  <p className="font-body-md text-body-md text-on-surface font-medium truncate">{lesson.title}</p>
                </div>
                <StatusBadge lesson={lesson} />
              </div>
              <p className="font-label-caps text-label-caps text-outline mt-1">Imported {formatRelativeTime(lesson.createdAt)}</p>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
