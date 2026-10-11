import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { NAV_GROUPS } from '../lib/nav-config.js';
import { getHealth } from '../lib/api.js';
import Icon from './Icon.jsx';

function StorageFooter() {
  const [status, setStatus] = useState({ state: 'checking', line: 'Checking database…' });

  useEffect(() => {
    let cancelled = false;
    let timer;

    const formatBytes = (bytes) => {
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const checkHealth = async () => {
      try {
        const health = await getHealth();
        if (cancelled) return;
        if (health.database !== 'online' || !Number.isFinite(health.bytes)) {
          throw new Error('Database health check did not confirm an online SQLite database.');
        }
        setStatus({ state: 'online', line: `${formatBytes(health.bytes)} on disk · data/nexus.db` });
      } catch {
        if (cancelled) return;
        setStatus({ state: 'offline', line: 'Backend unavailable · start with npm run dev' });
      } finally {
        if (!cancelled) timer = setTimeout(checkHealth, 10000);
      }
    };

    checkHealth();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="p-space-sm bg-surface-container-low border-t border-white/[0.04]">
      <div className="p-space-sm rounded-lg bg-surface-container-lowest flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${status.state === 'online' ? 'bg-tertiary' : status.state === 'offline' ? 'bg-error' : 'bg-outline animate-pulse'}`} />
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
            SQLite ({status.state})
          </span>
        </div>
        <div className="font-label-caps text-[10px] text-outline">{status.line}</div>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <aside
        id="nexus-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-200 h-screen flex flex-col shadow-[0_1px_12px_rgba(0,0,0,0.15)] ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ background: 'var(--app-sidebar-bg)', borderRight: '1px solid var(--app-border)' }}
      >
        <div className="h-16 px-space-md flex items-center justify-between shrink-0" style={{ background: 'var(--app-sidebar-bg)', borderBottom: '1px solid var(--app-border)' }}>
          <Link to="/home" className="flex items-center gap-space-sm" onClick={onClose}>
            <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-headline-sm">neurology</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">NEXUS</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-space-xs">AI Learning OS</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-on-surface-variant hover:text-on-surface p-1" aria-label="Close menu">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-space-xs py-space-sm">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-space-sm mb-space-xs mt-space-md first:mt-0">
                <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">{group.label}</span>
              </div>
              <nav className="flex flex-col gap-space-xs">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={`/${item.path}`}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-space-sm px-space-sm py-space-xs rounded transition-colors font-body-md text-body-md ${
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-medium'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`
                    }
                  >
                    <Icon icon={item.icon} />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <StorageFooter />
      </aside>

      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden ${open ? 'block' : 'hidden'}`}
      />
    </>
  );
}
