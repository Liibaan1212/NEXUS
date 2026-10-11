import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: 'bg-tertiary/15 text-tertiary',
  error: 'bg-error/15 text-error',
  info: 'bg-surface-container-high text-on-surface',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div id="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-enter px-space-md py-space-sm rounded-lg shadow-lg font-body-sm text-body-sm ${TOAST_STYLES[t.type] || TOAST_STYLES.info}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
