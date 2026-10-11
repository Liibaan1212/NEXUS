import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchLessons } from '../lib/lessons-repo.js';
import { NAV_GROUPS } from '../lib/nav-config.js';
import Icon from './Icon.jsx';

const NAV_ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label, kind: 'module' }))
);
const QUICK_PATHS = new Set(['home', 'lessons', 'knowledge', 'code-lab', 'ai-tutor', 'my-journey', 'notes', 'analytics']);

export default function ThirdEye() {
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const modules = useMemo(
    () => NAV_ITEMS.filter((item) => {
      if (!normalizedQuery) return QUICK_PATHS.has(item.path);
      return `${item.label} ${item.group} ${item.path}`.toLocaleLowerCase().includes(normalizedQuery);
    }),
    [normalizedQuery]
  );
  const items = useMemo(
    () => [
      ...modules.map((item) => ({ ...item, kind: 'module' })),
      ...lessons.map((lesson) => ({ ...lesson, kind: 'lesson' })),
    ],
    [modules, lessons]
  );

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const search = query.trim();
    if (search.length < 2) {
      setLessons([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await searchLessons({ query: search });
        if (requestId === requestRef.current) setLessons(results);
      } catch (err) {
        if (requestId === requestRef.current) {
          setLessons([]);
          setError(err instanceof Error ? err.message : 'Lesson search failed.');
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, lessons]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === 'ArrowDown' && items.length) {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % items.length);
      } else if (event.key === 'ArrowUp' && items.length) {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      } else if (event.key === 'Enter' && items[activeIndex]) {
        event.preventDefault();
        openItem(items[activeIndex]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, items, open]);

  function openItem(item) {
    navigate(item.kind === 'lesson' ? `/lesson-sandbox/${encodeURIComponent(item.id)}` : `/${item.path}`);
    setOpen(false);
    setQuery('');
    setLessons([]);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setLessons([]);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="third-eye-trigger"
        aria-label="Open Third Eye quick access"
        title="Third Eye quick access (Ctrl+K)"
      >
        <span className="third-eye-mark" aria-hidden="true">
          <span className="third-eye-pupil" />
        </span>
        <span className="third-eye-trigger-label">Third Eye</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="third-eye-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section className="third-eye-panel" role="dialog" aria-modal="true" aria-labelledby="third-eye-title">
            <div className="third-eye-heading">
              <div className="third-eye-heading-mark" aria-hidden="true">
                <span className="third-eye-orbit" />
                <span className="third-eye-mark"><span className="third-eye-pupil" /></span>
              </div>
              <div>
                <p className="third-eye-eyebrow">NEXUS QUICK ACCESS</p>
                <h2 id="third-eye-title">See your next move.</h2>
              </div>
              <button type="button" className="third-eye-close" onClick={close} aria-label="Close Third Eye">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="third-eye-search">
              <span className="material-symbols-outlined" aria-hidden="true">search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a module or lesson…"
                aria-label="Find a module or lesson"
                aria-controls="third-eye-results"
                aria-activedescendant={items.length ? `third-eye-option-${activeIndex}` : undefined}
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
              />
              <kbd>ESC</kbd>
            </label>

            <div className="third-eye-results" id="third-eye-results" role="listbox" aria-label="Quick access results">
              {!normalizedQuery && <p className="third-eye-section-label">QUICK DESTINATIONS</p>}
              {modules.length > 0 && normalizedQuery && <p className="third-eye-section-label">MODULES</p>}
              {items.map((item, index) => (
                <button
                  id={`third-eye-option-${index}`}
                  key={`${item.kind}-${item.kind === 'lesson' ? item.id : item.path}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`third-eye-result ${index === activeIndex ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openItem(item)}
                >
                  {item.kind === 'module' ? <Icon icon={item.icon} className="third-eye-result-icon" /> : <span className="material-symbols-outlined third-eye-result-icon">menu_book</span>}
                  <span className="third-eye-result-copy">
                    <span className="third-eye-result-title">{item.kind === 'lesson' ? item.title : item.label}</span>
                    <span className="third-eye-result-meta">{item.kind === 'lesson' ? item.category || 'Lesson' : item.group}</span>
                  </span>
                  <span className="material-symbols-outlined third-eye-result-arrow" aria-hidden="true">north_west</span>
                </button>
              ))}

              {loading && <p className="third-eye-message"><span className="third-eye-loader" />Searching your lesson library…</p>}
              {error && <p className="third-eye-message is-error" role="status">Lesson search unavailable: {error}</p>}
              {!loading && normalizedQuery.length >= 2 && modules.length === 0 && lessons.length === 0 && !error && (
                <p className="third-eye-message">No matching modules or lessons.</p>
              )}
              {normalizedQuery.length === 1 && <p className="third-eye-message">Type one more character to search lessons.</p>}
            </div>

            <footer className="third-eye-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Open</span>
              <span><kbd>ESC</kbd> Close</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
