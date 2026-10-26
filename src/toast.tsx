import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ToastAction = { label: string; onClick: () => void };
type ToastType = 'success' | 'error';
type ToastItem = { id: number; type: ToastType; message: string; action?: ToastAction };
type ToastContextValue = {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((type: ToastType, message: string, action?: ToastAction) => {
    const id = ++nextId.current;
    setToasts(current => [...current, { id, type, message, action }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), type === 'success' ? 4000 : 8000));
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    success: (message, action) => notify('success', message, action),
    error: message => notify('error', message),
  }), [notify]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-viewport" aria-label="Notificações">
      {toasts.map(toast => <div
        className={`toast toast-${toast.type}`}
        key={toast.id}
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        onMouseEnter={() => {
          const timer = timers.current.get(toast.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(toast.id);
        }}
        onMouseLeave={event => {
          if (!event.currentTarget.contains(document.activeElement) && !timers.current.has(toast.id)) timers.current.set(toast.id, window.setTimeout(() => dismiss(toast.id), toast.type === 'success' ? 4000 : 8000));
        }}
        onFocus={() => {
          const timer = timers.current.get(toast.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(toast.id);
        }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !event.currentTarget.matches(':hover') && !timers.current.has(toast.id)) {
            timers.current.set(toast.id, window.setTimeout(() => dismiss(toast.id), toast.type === 'success' ? 4000 : 8000));
          }
        }}
      >
        <span className="toast-message">{toast.message}</span>
        {toast.action && <button type="button" className="toast-action" onClick={toast.action.onClick}>{toast.action.label}</button>}
        <button type="button" className="toast-close" aria-label="Fechar notificação" onClick={() => dismiss(toast.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast deve ser usado dentro de ToastProvider.');
  return value;
}
