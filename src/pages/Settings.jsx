import { useEffect, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { getSettings, saveSettings, getStorage } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

const THEME_KEY = 'nexus-theme-mode';
const THEME_OPTIONS = [
  { id: 'day', label: 'Day mode', description: 'Warm daylight palette', accent: '#f97316' },
  { id: 'anthropic', label: 'System', description: 'Deep neutral editorial look', accent: '#ff8d5c' },
  { id: 'sky', label: 'Sky blue', description: 'Cool air and calm contrast', accent: '#38bdf8' },
  { id: 'aurora', label: 'Aurora', description: 'Violet and teal glow', accent: '#8b5cf6' },
  { id: 'midnight', label: 'Midnight', description: 'Focused dark mode', accent: '#4f8cff' },
  { id: 'sunset', label: 'Sunset', description: 'Warm cinematic energy', accent: '#f97316' },
];

function readTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) || 'day';
  } catch {
    return 'day';
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  window.localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new Event('theme-mode-change'));
}

export default function Settings() {
  const showToast = useToast();
  const { loading, error, data, reload } = useAsyncLoad(async () => {
    const [settings, storage] = await Promise.all([getSettings(), getStorage()]);
    return { settings, storage };
  });
  const [form, setForm] = useState({
    displayName: '',
    wordsPerMinute: '200',
    modelNote: '',
    avatar: '',
    streak: '0',
  });
  const [theme, setTheme] = useState(readTheme());
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    setForm({
      displayName: data.settings.displayName || '',
      wordsPerMinute: data.settings.wordsPerMinute || '200',
      modelNote: data.settings.modelNote || '',
      avatar: data.settings.avatar || '',
      streak: data.settings.streak || '0',
    });
  }, [data]);

  async function handleSave(e) {
    e.preventDefault();
    await saveSettings(form);
    window.dispatchEvent(new Event('settings-updated'));
    showToast('Settings saved', 'success');
    reload();
  }

  function handleAvatarChange(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('Choose an image smaller than 4 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, avatar: String(reader.result || '') }));
    reader.onerror = () => showToast('Could not read that image.', 'error');
    reader.readAsDataURL(file);
  }

  function handleThemeChange(nextTheme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <PageShell title="Settings & Model Config" description="Local preferences. Data lives in data/nexus.db on this machine." loading={loading} error={error}>
      {data && (
        <>
          <div className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-on-surface-variant">
            <div className="theme-mode-panel">
              <div>
                <span className="font-label-caps text-label-caps text-outline uppercase">Appearance</span>
                <h3 className="theme-panel-title">Choose a system mood</h3>
              </div>
              <div className="theme-toggle-row">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`theme-toggle ${theme === option.id ? 'active' : ''}`}
                    aria-pressed={theme === option.id}
                    onClick={() => handleThemeChange(option.id)}
                    style={{ '--theme-accent': option.accent }}
                  >
                    <span className="theme-toggle-dot" />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-on-surface-variant">
            <p><span className="text-outline">Database:</span> {data.storage.path}</p>
            <p className="mt-1"><span className="text-outline">Size:</span> {((data.storage.bytes || 0) / 1024).toFixed(1)} KB</p>
            <p className="mt-1"><span className="text-outline">Mode:</span> Offline Node.js + SQLite</p>
          </div>
          <form onSubmit={handleSave} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
            <div className="settings-avatar-row">
              <button type="button" className="settings-avatar-preview" onClick={() => form.avatar && setShowAvatarPreview(true)} aria-label={form.avatar ? 'Open profile photo preview' : 'No profile photo selected'}>
                {form.avatar ? <img src={form.avatar} alt="Profile preview" /> : <span className="material-symbols-outlined">person</span>}
              </button>
              <div className="flex flex-col gap-1">
                <label htmlFor="profile-picture" className="settings-avatar-button"><span className="material-symbols-outlined">photo_camera</span>Update profile picture</label>
                <input id="profile-picture" type="file" accept="image/*" onChange={handleAvatarChange} className="settings-file-input" />
                <span className="font-label-caps text-label-caps text-outline">JPG, PNG, GIF, or WebP · max 4 MB</span>
              </div>
            </div>
            <label className="font-label-caps text-label-caps text-outline uppercase">Display name</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none"
            />
            <label className="font-label-caps text-label-caps text-outline uppercase">Words per minute</label>
            <input
              value={form.wordsPerMinute}
              onChange={(e) => setForm({ ...form, wordsPerMinute: e.target.value })}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none"
            />
            <label className="font-label-caps text-label-caps text-outline uppercase">Day streak</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.streak}
              onChange={(e) => setForm({ ...form, streak: e.target.value })}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none"
            />
            <label className="font-label-caps text-label-caps text-outline uppercase">Local model note</label>
            <input
              value={form.modelNote}
              onChange={(e) => setForm({ ...form, modelNote: e.target.value })}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none"
            />
            <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Save settings</button>
          </form>

          {showAvatarPreview && form.avatar && (
            <div className="avatar-preview-backdrop" role="presentation" onClick={() => setShowAvatarPreview(false)}>
              <div className="avatar-preview-card" role="dialog" aria-modal="true" aria-label="Profile photo preview" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="avatar-preview-close" onClick={() => setShowAvatarPreview(false)} aria-label="Close profile photo">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <img src={form.avatar} alt="Profile preview" className="avatar-preview-image" />
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
