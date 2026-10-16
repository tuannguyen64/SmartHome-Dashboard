import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = ++seq.current;
      const t = typeof toast === 'string' ? { text: toast } : toast;
      setToasts((list) => [...list.slice(-3), { id, tone: 'blue', ...t }]);
      setTimeout(() => dismiss(id), t.duration ?? 4500);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      show: push,
      success: (text, title) => push({ tone: 'green', text, title }),
      error: (text, title) => push({ tone: 'red', text, title, duration: 6000 }),
      warn: (text, title) => push({ tone: 'amber', text, title, duration: 6000 }),
      info: (text, title) => push({ tone: 'blue', text, title }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && <strong>{t.title}</strong>}
              <span>{t.text}</span>
            </div>
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => dismiss(t.id)} aria-label="Đóng">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
