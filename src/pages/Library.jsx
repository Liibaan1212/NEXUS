import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchLessons, listCategories, getStats, toggleCompleted, toggleBookmarked, updateLesson, downloadWeekPackage, deleteLesson } from '../lib/lessons-repo.js';
import { sortLessonsForDisplay } from '../lib/utils.js';
import LessonCard from '../components/LessonCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not-started', label: 'Not started' },
];

export default function Library({ mode = 'all' }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { confirm } = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();

  const isBookmarksView = mode === 'bookmarked';
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [appliedQuery, setAppliedQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState(isBookmarksView ? 'bookmarked' : 'all');
  const [sortMode, setSortMode] = useState('recent');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, bookmarked: 0, percentComplete: 0 });
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [results, cats, stats] = await Promise.all([
        searchLessons({ query: appliedQuery, category, status }),
        listCategories(),
        getStats(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setLessons(results);
      setCategories(cats);
      setStats(stats);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [appliedQuery, category, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box, and reflect it in the URL for /lessons.
  useEffect(() => {
    const timer = setTimeout(() => {
      const normalizedQuery = query.replace(/\s+/g, ' ').trim();
      setAppliedQuery(normalizedQuery);
      if (!isBookmarksView) setSearchParams(normalizedQuery ? { q: normalizedQuery } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, isBookmarksView, setSearchParams]);

  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    setQuery((current) => current === urlQuery ? current : urlQuery);
    setAppliedQuery((current) => current === urlQuery ? current : urlQuery);
  }, [searchParams]);

  async function handleToggleComplete(id) {
    try {
      const updated = await toggleCompleted(id);
      showToast(updated.completed ? 'Marked as completed' : 'Marked as not completed', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleToggleBookmark(id) {
    try {
      const updated = await toggleBookmarked(id);
      showToast(updated.bookmarked ? 'Bookmarked' : 'Bookmark removed', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDelete(id) {
    const confirmed = await confirm({ title: 'Delete this lesson?', message: 'This lesson will be permanently removed from your local database.', confirmLabel: 'Delete lesson', tone: 'danger' });
    if (!confirmed) return;
    try {
      await deleteLesson(id);
      showToast('Lesson deleted', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleAssignWeek(id, week, day) {
    try {
      const assignedWeek = week ? Number(week) : null;
      await updateLesson(id, { week: assignedWeek, day: assignedWeek && day ? Number(day) : null });
      showToast(assignedWeek ? `Lesson assigned to Week ${assignedWeek}` : 'Lesson removed from weekly plan', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handlePackageWeek(week) {
    try {
      const blob = await downloadWeekPackage(week);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nexus-week-${week}-study-pack.html`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Week ${week} packaged for download`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const sortedLessons = useMemo(() => sortLessonsForDisplay(lessons, sortMode), [lessons, sortMode]);

  const weekGroups = useMemo(() => {
    const groups = new Map();
    sortedLessons.forEach((lesson) => {
      const week = lesson.week ? Number(lesson.week) : null;
      if (!groups.has(week)) groups.set(week, []);
      groups.get(week).push(lesson);
    });
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });
  }, [sortedLessons]);

  const title = isBookmarksView ? 'Bookmarks' : 'Lessons Library';
  const description = isBookmarksView ? "Lessons you've starred for later." : "Every lesson you've imported, in one place.";

  return (
    <div className="p-space-md lg:p-space-lg flex flex-col gap-space-md max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{description}</p>
        </div>
        <button
          onClick={() => navigate('/lesson-importer')}
          className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold flex items-center gap-space-xs shrink-0"
        >
          <span className="material-symbols-outlined text-headline-sm">upload_file</span>
          Import lesson
        </button>
      </div>

      {!loading && !error && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
          <LibraryStat label="Total lessons" value={stats.total} icon="menu_book" />
          <LibraryStat label="Completed" value={`${stats.percentComplete}%`} icon="task_alt" accent="text-tertiary" />
          <LibraryStat label="In progress" value={stats.inProgress} icon="pending" />
          <LibraryStat label="Bookmarked" value={stats.bookmarked} icon="bookmark" />
        </div>
      )}

      <div className="rounded-xl bg-surface-container-low p-space-sm flex flex-col gap-space-sm">
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <div className="flex items-center flex-1 bg-surface-container px-space-sm py-space-xs rounded-lg">
            <span className="material-symbols-outlined text-on-surface-variant mr-space-xs text-body-md">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, category, or content\u2026"
              className="w-full bg-transparent border-none text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none"
            />
          </div>
          {!isBookmarksView && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm text-body-sm"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        {!isBookmarksView && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`px-space-sm py-1 rounded font-label-caps text-label-caps ${
                  status === t.value ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {t.label}
              </button>
            ))}
            {(query || category !== 'all' || status !== 'all') && (
            <button onClick={() => { setQuery(''); setCategory('all'); setStatus('all'); }} className="px-space-sm py-1 rounded font-label-caps text-label-caps text-primary hover:bg-surface-container">Clear filters</button>
            )}
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="bg-surface-container px-space-sm py-1 rounded text-on-surface font-label-caps text-label-caps" aria-label="Lesson layout">
              <option value="recent">Recent order</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="week">Group by weeks</option>
            </select>
          </div>
        )}
        <p className="font-label-caps text-label-caps text-outline">{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} shown</p>
      </div>

      {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading your lessons\u2026</p>}

      {!loading && error && (
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">Couldn't load your lessons</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{error}</p>
        </div>
      )}

      {!loading && !error && stats.total === 0 && (
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 40 }}>upload_file</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">No lessons yet</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">Upload one of your HTML lesson files to get started \u2014 it'll show up here, ready to open and track.</p>
          <button onClick={() => navigate('/lesson-importer')} className="mt-space-xs px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold">Import a lesson</button>
        </div>
      )}

      {!loading && !error && stats.total > 0 && lessons.length === 0 && (
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-xs">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 32 }}>search_off</span>
          <p className="font-body-md text-body-md text-on-surface">No lessons match these filters</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Try a different search term, category, or status.</p>
        </div>
      )}

      {!loading && !error && lessons.length > 0 && (
        sortMode === 'week' ? <div className="flex flex-col gap-space-md">
          {weekGroups.map(([week, group]) => <section key={week ?? 'unassigned'} className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-space-sm">
              <div><h2 className="font-headline-sm text-headline-sm text-on-surface">{week ? `Week ${week}` : 'Unassigned'}</h2><p className="font-label-caps text-label-caps text-outline">{group.length} {group.length === 1 ? 'lesson' : 'lessons'}</p></div>
              {week && <button onClick={() => handlePackageWeek(week)} className="library-package-button"><span className="material-symbols-outlined">download</span>Package week</button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">{group.sort((a, b) => (a.day || 99) - (b.day || 99)).map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onToggleComplete={handleToggleComplete} onToggleBookmark={handleToggleBookmark} onDelete={handleDelete} onAssignWeek={handleAssignWeek} />)}</div>
          </section>)}
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {sortedLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onToggleComplete={handleToggleComplete} onToggleBookmark={handleToggleBookmark} onDelete={handleDelete} onAssignWeek={handleAssignWeek} />)}
        </div>
      )}
    </div>
  );
}

function LibraryStat({ label, value, icon, accent = 'text-primary' }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-sm flex items-center gap-space-sm">
      <span className={`material-symbols-outlined ${accent} text-headline-sm`}>{icon}</span>
      <div>
        <p className="font-headline-sm text-headline-sm text-on-surface">{value}</p>
        <p className="font-label-caps text-label-caps text-outline">{label}</p>
      </div>
    </div>
  );
}
