import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getContinueLesson, getRecentlyOpened } from '../lib/lessons-repo.js';
import { getSettings, listNotes } from '../lib/modules-repo.js';
import { NOTE_CACHE_KEY, mergeNotesWithCache, readCachedNotes } from '../lib/note-cache.js';
import { formatRelativeTime } from '../lib/utils.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ContinueCard({ stats, continueLesson }) {
  const navigate = useNavigate();

  if (stats.total === 0) {
    return (
      <div className="p-space-lg rounded-xl bg-surface-container-low shadow-xl flex flex-col gap-space-sm h-full">
        <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider">Get started</span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Import your first lesson</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Upload one of your HTML lesson files and it'll show up here, ready to open.</p>
        <button onClick={() => navigate('/lesson-importer')} className="mt-space-xs self-start px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-semibold text-body-sm flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-body-md">upload_file</span> Import a lesson
        </button>
      </div>
    );
  }

  if (!continueLesson) {
    return (
      <div className="p-space-lg rounded-xl bg-surface-container-low shadow-xl flex flex-col gap-space-sm h-full">
        <span className="font-label-caps text-label-caps text-tertiary uppercase tracking-wider">All caught up</span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Every lesson is marked complete</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Import more lessons, or revisit one from your library.</p>
        <button onClick={() => navigate('/lessons')} className="mt-space-xs self-start px-space-md py-space-sm rounded-lg bg-surface-container-high text-on-surface font-semibold text-body-sm">Browse library</button>
      </div>
    );
  }

  const pct = Math.round((continueLesson.maxScrollFraction || 0) * 100);
  return (
    <div className="memory-rail-card">
      <span className="memory-rail-label">Memory cues</span>
      <h2>{continueLesson.title}</h2>
      <p>{continueLesson.excerpt || 'No preview available.'}</p>
      <div className="memory-rail-progress">
        <div className="memory-rail-progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <button onClick={() => navigate(`/lesson-sandbox/${continueLesson.id}`)} className="memory-rail-button">
        {pct > 0 ? 'Continue' : 'Start'} lesson
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  );
}

function StatTile({ label, value, colorClass }) {
  return (
    <div className="flex flex-col">
      <span className="font-label-caps text-label-caps text-outline uppercase">{label}</span>
      <span className={`font-label-metric text-headline-sm ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, stats: null, continueLesson: null, recent: [], displayName: 'Learner' });
  const [memoryIndex, setMemoryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cachedNotes = readCachedNotes(NOTE_CACHE_KEY, []);

    Promise.all([
      getStats(),
      getContinueLesson(),
      getRecentlyOpened(5),
    ]).then(([stats, continueLesson, recent]) => {
      if (cancelled) return;
      setState((current) => ({
        ...current,
        loading: false,
        error: null,
        stats,
        continueLesson,
        recent,
        notes: cachedNotes,
      }));

      Promise.all([
        getSettings().catch(() => ({ displayName: 'Learner' })),
        listNotes().catch(() => cachedNotes),
      ]).then(([settings, notes]) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          notes: mergeNotesWithCache(notes, cachedNotes),
          displayName: settings.displayName || 'Learner',
        }));
      });
    }).catch((err) => {
      if (!cancelled) setState((current) => ({
        ...current,
        loading: false,
        error: err.message,
        stats: null,
        continueLesson: null,
        recent: [],
      }));
    });

    return () => { cancelled = true; };
  }, []);

  const pinnedNotes = (state.notes || []).filter((note) => note.pinned).slice(0, 4);
  useEffect(() => {
    if (pinnedNotes.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setMemoryIndex((current) => (current + 1) % pinnedNotes.length);
    }, 150000);
    return () => window.clearInterval(timer);
  }, [pinnedNotes.length]);

  if (state.loading) {
    return <div className="p-space-lg"><p className="font-body-sm text-body-sm text-on-surface-variant">Loading your dashboard\u2026</p></div>;
  }
  if (state.error) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">Couldn't load your dashboard</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{state.error}</p>
        </div>
      </div>
    );
  }

  const { stats, continueLesson, recent, notes = [], displayName } = state;
  const activeMemoryNote = pinnedNotes[memoryIndex] || null;

  return (
    <div className="px-space-md lg:px-space-lg py-space-lg flex flex-col gap-space-lg max-w-6xl mx-auto">
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-stretch">
        <div className="xl:col-span-7 flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low shadow-xl">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">{displayName}</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              {stats.total === 0
                ? "You haven't imported any lessons yet."
                : `You've imported ${stats.total} lesson${stats.total === 1 ? '' : 's'} and completed ${stats.percentComplete}% of them.`}
            </p>
          </div>

          {activeMemoryNote && (
            <div className="home-memory-banner">
              <div className="home-memory-banner-head">
                <span className="home-memory-banner-label"><span className="material-symbols-outlined">auto_awesome</span> Memory cues</span>
                <button onClick={() => navigate('/notes')} className="home-memory-banner-link">Open Notes Manager</button>
              </div>

              <div className="home-memory-banner-body">
                <article className={`home-memory-banner-card ${activeMemoryNote.color || 'sun'}`} key={activeMemoryNote.id}>
                  <span className="material-symbols-outlined">push_pin</span>
                  <span className="home-memory-category">{activeMemoryNote.category || 'lesson'}</span>
                  <h3>{activeMemoryNote.title || 'Memory cue'}</h3>
                  <p>{activeMemoryNote.body || 'A note worth keeping in sight.'}</p>
                </article>

                {pinnedNotes.length > 1 && (
                  <div className="home-memory-dots" aria-label="Memory cue carousel indicators">
                    {pinnedNotes.map((note, index) => (
                      <button
                        key={note.id}
                        type="button"
                        aria-label={`Show memory cue ${index + 1}`}
                        className={`home-memory-dot ${index === memoryIndex ? 'active' : ''}`}
                        onClick={() => setMemoryIndex(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-space-lg pt-space-md bg-surface-container/60 rounded-lg p-space-md">
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Overall progress</span>
              <span className="font-label-metric text-label-metric text-primary-container">{stats.percentComplete}% complete</span>
            </div>
            <div className="w-full h-2 rounded bg-surface-container-highest overflow-hidden">
              <div className="h-full bg-primary-container" style={{ width: `${stats.percentComplete}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-space-sm mt-space-md">
              <StatTile label="Total lessons" value={stats.total} colorClass="text-on-surface" />
              <StatTile label="Completed" value={stats.completed} colorClass="text-primary" />
              <StatTile label="Bookmarked" value={stats.bookmarked} colorClass="text-secondary" />
            </div>
          </div>
        </div>
        <div className="xl:col-span-5 flex">
          <ContinueCard stats={stats} continueLesson={continueLesson} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-on-surface">Recently opened</span>
            <button onClick={() => navigate('/lessons')} className="font-label-caps text-label-caps text-primary hover:underline">View library</button>
          </div>
          {recent.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Lessons you open will show up here.</p>
          ) : (
            <div className="flex flex-col gap-space-xs">
              {recent.map((l) => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/lesson-sandbox/${l.id}`)}
                  className="text-left p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-between gap-space-sm"
                >
                  <div className="min-w-0">
                    <span className="font-body-sm text-body-sm text-on-surface font-medium truncate block">{l.title}</span>
                    <span className="font-label-caps text-label-caps text-outline">{l.category}</span>
                  </div>
                  <span className="font-label-caps text-label-caps text-outline shrink-0">{formatRelativeTime(l.lastOpenedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col gap-space-sm">
          <span className="font-headline-sm text-headline-sm text-on-surface">Import a lesson</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Bring in one of your own HTML lesson files \u2014 NEXUS will parse it, sanitize it, and add it to your library.</p>
          <button onClick={() => navigate('/lesson-importer')} className="self-start px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold text-body-sm flex items-center gap-space-xs transition-colors">
            <span className="material-symbols-outlined text-body-md">upload_file</span> Open Import Center
          </button>
        </div>
      </section>

      {notes.filter((note) => note.pinned).length > 0 && (
        <section className="home-memory-section">
          <div className="flex items-end justify-between gap-3">
            <div><span className="home-memory-eyebrow"><span className="material-symbols-outlined">auto_awesome</span> Memory cues</span><h2 className="font-headline-sm text-headline-sm text-on-surface">Keep these close today.</h2></div>
            <button onClick={() => navigate('/notes')} className="font-label-caps text-label-caps text-primary hover:underline">Open Notes Manager</button>
          </div>
          <div className="home-memory-grid">
            {notes.filter((note) => note.pinned).slice(0, 3).map((note) => <article key={note.id} className={`home-memory-card ${note.color || 'sun'}`}><span className="material-symbols-outlined">push_pin</span><span className="home-memory-category">{note.category || 'lesson'}</span><h3>{note.title}</h3><p>{note.body || 'A note worth keeping in sight.'}</p></article>)}
          </div>
        </section>
      )}
    </div>
  );
}
