import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../lib/modules-repo.js';
import ThirdEye from './ThirdEye.jsx';
import NextDoor from './NextDoor.jsx';

const THEME_KEY = 'nexus-theme-mode';
const THEME_SEQUENCE = ['day', 'anthropic', 'sky', 'aurora', 'midnight', 'sunset'];

function readTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) || 'day';
  } catch {
    return 'day';
  }
}

function applyTheme(theme) {
  const next = theme || 'day';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next === 'day' ? 'light' : 'dark';
  window.localStorage.setItem(THEME_KEY, next);
  window.dispatchEvent(new Event('theme-mode-change'));
}

const THEME_META = {
  day: { icon: 'light_mode', label: 'Day', accent: '#f97316' },
  anthropic: { icon: 'dark_mode', label: 'System', accent: '#ff8d5c' },
  sky: { icon: 'wb_sunny', label: 'Sky', accent: '#38bdf8' },
  aurora: { icon: 'auto_awesome', label: 'Aurora', accent: '#8b5cf6' },
  midnight: { icon: 'nights_stay', label: 'Midnight', accent: '#4f8cff' },
  sunset: { icon: 'wb_twilight', label: 'Sunset', accent: '#fb7185' },
};

export default function Header({ onOpenMenu }) {
  const navigate = useNavigate();
  const themeMenuRef = useRef(null);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState({ streak: 0, avatar: '' });
  const [theme, setTheme] = useState(readTheme());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  function loadProfile() {
    getSettings()
      .then((settings) => setProfile({ streak: Number(settings.streak) || 0, avatar: settings.avatar || '' }))
      .catch(() => setProfile({ streak: 0, avatar: '' }));
  }

  useEffect(() => {
    loadProfile();
    window.addEventListener('settings-updated', loadProfile);
    return () => window.removeEventListener('settings-updated', loadProfile);
  }, []);

  useEffect(() => {
    const syncTheme = () => setTheme(readTheme());
    syncTheme();
    window.addEventListener('theme-mode-change', syncTheme);
    return () => window.removeEventListener('theme-mode-change', syncTheme);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!themeMenuRef.current) return;
      if (!themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/lessons?q=${encodeURIComponent(q)}` : '/lessons');
  }

  function handleThemeSelect(nextTheme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setThemeMenuOpen(false);
  }

  const activeTheme = THEME_META[theme] || THEME_META.day;

  return (
    <header
      className="fixed top-0 left-0 lg:left-72 right-0 h-16 backdrop-blur-xl z-30 flex items-center justify-between px-space-md gap-space-sm"
      style={{ background: 'color-mix(in srgb, var(--theme-bg) 88%, rgba(255,255,255,0.02))', boxShadow: 'var(--app-shadow)' }}
    >
      <div className="flex items-center gap-space-sm flex-1 max-w-xl">
        <button onClick={onOpenMenu} className="lg:hidden text-on-surface-variant hover:text-on-surface p-1" aria-label="Open menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <form onSubmit={handleSearchSubmit} className="flex items-center w-full bg-surface-container px-space-md py-space-xs rounded-xl focus-within:ring-1 focus-within:ring-primary-container">
          <span className="material-symbols-outlined text-on-surface-variant mr-space-sm text-body-md">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none"
            placeholder="Search your lessons…"
          />
        </form>
        <button
          onClick={() => navigate('/lesson-importer')}
          className="hidden sm:flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors whitespace-nowrap"
          title="Upload a new lesson"
        >
          <span className="material-symbols-outlined text-headline-sm text-primary">add_box</span>
          <span className="font-body-sm text-body-sm">Add lesson</span>
        </button>
      </div>
      <div className="flex items-center gap-space-sm shrink-0">
        <ThirdEye />
        <NextDoor />
        <div ref={themeMenuRef} className="theme-picker-wrap">
          <button
            type="button"
            onClick={() => setThemeMenuOpen((open) => !open)}
            className="mode-toggle"
            title={`Current mode: ${activeTheme.label}. Click to switch theme.`}
            aria-label={`Current mode: ${activeTheme.label}. Click to switch theme.`}
            aria-expanded={themeMenuOpen}
            style={{ '--mode-accent': activeTheme.accent }}
          >
            <span className="mode-toggle-glow" />
            <span className="material-symbols-outlined mode-toggle-icon">{activeTheme.icon}</span>
            <span className="mode-toggle-label">{activeTheme.label}</span>
          </button>

          <div className={`theme-picker-panel ${themeMenuOpen ? 'open' : ''}`} role="menu" aria-label="Theme selector">
            {THEME_SEQUENCE.map((key) => {
              const option = THEME_META[key];
              const selected = key === theme;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => handleThemeSelect(key)}
                  className={`theme-picker-option ${selected ? 'selected' : ''}`}
                  style={{ '--theme-option-accent': option.accent }}
                  title={option.label}
                  aria-label={`Select ${option.label} theme`}
                >
                  <span className="theme-picker-icon material-symbols-outlined">{option.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container" title="Days with recorded lesson activity">
          <span className="material-symbols-outlined text-primary text-headline-sm">local_fire_department</span>
          <span className="font-label-metric text-label-metric text-primary">{profile.streak} DAY STREAK</span>
        </div>
        <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container" title="Local SQLite backend">
          <span className="w-2 h-2 rounded-full bg-tertiary" />
          <span className="font-body-sm text-body-sm text-on-surface-variant">Offline DB:</span>
          <span className="font-label-metric text-label-metric text-tertiary">SQLite</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-space-xs pl-space-sm"
          title="Open settings"
          aria-label="Open settings"
        >
          <div className="profile-avatar w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant overflow-hidden">
            {profile.avatar ? <img src={profile.avatar} alt="Profile" /> : <span className="material-symbols-outlined text-headline-sm">person</span>}
          </div>
        </button>
      </div>
    </header>
  );
}
