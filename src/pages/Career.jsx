import { useEffect, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { getSettings, saveSettings, getAnalytics } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Career() {
  const showToast = useToast();
  const { loading, error, data, reload } = useAsyncLoad(async () => {
    const [settings, analytics] = await Promise.all([getSettings(), getAnalytics()]);
    return { settings, analytics };
  });
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [focus, setFocus] = useState('Machine Learning Engineer');

  useEffect(() => {
    if (!data?.settings) return;
    setHeadline(data.settings.headline || '');
    setBio(data.settings.bio || '');
    setFocus(data.settings.focus || 'Machine Learning Engineer');
  }, [data]);

  async function handleSave(e) {
    e.preventDefault();
    await saveSettings({ headline, bio, focus });
    showToast('Profile saved', 'success');
    reload();
  }

  return (
    <PageShell title="Engineer Profile" description="Your offline career profile — used across job readiness views." loading={loading} error={error}>
      {data && (
        <>
          <div className="grid grid-cols-3 gap-space-sm">
            <Tile label="Lessons done" value={data.analytics.stats.completed} />
            <Tile label="Streak" value={`${data.analytics.streak}d`} />
            <Tile label="Opens" value={data.analytics.totalOpens} />
          </div>
          <form onSubmit={handleSave} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
            <label className="font-label-caps text-label-caps text-outline uppercase">Display name</label>
            <p className="font-headline-sm text-on-surface">{data.settings.displayName || 'Learner'}</p>
            <label className="font-label-caps text-label-caps text-outline uppercase">Focus role</label>
            <input value={focus} onChange={(e) => setFocus(e.target.value)} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
            <label className="font-label-caps text-label-caps text-outline uppercase">Headline</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
            <label className="font-label-caps text-label-caps text-outline uppercase">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
            <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Save profile</button>
          </form>
        </>
      )}
    </PageShell>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-space-md">
      <p className="font-label-caps text-label-caps text-outline">{label}</p>
      <p className="font-headline-lg text-on-surface mt-1">{value}</p>
    </div>
  );
}
