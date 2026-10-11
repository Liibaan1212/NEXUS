import { useEffect, useState } from 'react';

/** Shared shell for module pages — loading / error / empty / content. */
export default function PageShell({ title, description, loading, error, children, actions }) {
  if (loading) {
    return (
      <div className="p-space-lg">
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">Something went wrong</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{error}</p>
          <p className="font-body-sm text-body-sm text-outline mt-space-sm">
            Make sure the Node backend is running (`npm run server` or `npm run dev`).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-space-md lg:p-space-lg max-w-5xl mx-auto flex flex-col gap-space-md" style={{ color: 'var(--app-ink)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          {description && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function useAsyncLoad(loader, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const reload = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState({ loading: false, error: err.message, data: null });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loader();
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}
