import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setDialog({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'default',
    });
  }), []);

  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDialog(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialog, closeDialog]);

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog(false);
        }}>
          <section className="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
            <div className={`dialog-icon ${dialog.tone === 'danger' ? 'dialog-icon-danger' : ''}`}>
              <span className="material-symbols-outlined">{dialog.tone === 'danger' ? 'delete' : 'help'}</span>
            </div>
            <div className="dialog-content">
              <h2 id="dialog-title" className="font-headline-sm text-headline-sm text-on-surface">{dialog.title}</h2>
              <p id="dialog-message" className="font-body-sm text-body-sm text-on-surface-variant">{dialog.message}</p>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => closeDialog(false)} className="dialog-button dialog-button-secondary">{dialog.cancelLabel}</button>
              <button type="button" autoFocus onClick={() => closeDialog(true)} className={`dialog-button ${dialog.tone === 'danger' ? 'dialog-button-danger' : 'dialog-button-primary'}`}>{dialog.confirmLabel}</button>
            </div>
          </section>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used inside <DialogProvider>');
  return context;
}
