import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; type: ToastType; icon?: string; leaving?: boolean; }
interface ToastCtx { toast: (m: string, type?: ToastType, icon?: string) => void; success: (m: string, icon?: string) => void; error: (m: string, icon?: string) => void; info: (m: string, icon?: string) => void; }
const ToastContext = createContext<ToastCtx | null>(null);
const TYPE_ICONS: Record<ToastType, string> = { success: 'checkmark', error: 'x-mark', info: 'light-bulb' };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', icon?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, message, type, icon }]);
    timers.current[id] = setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const success = useCallback((m: string, icon?: string) => toast(m, 'success', icon), [toast]);
  const error   = useCallback((m: string, icon?: string) => toast(m, 'error', icon), [toast]);
  const info    = useCallback((m: string, icon?: string) => toast(m, 'info', icon), [toast]);

  const ICONS: Record<ToastType, string> = { success: '✅', error: '❌', info: '💡' };

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}${t.leaving ? ' leaving' : ''}`} onClick={() => dismiss(t.id)} style={{ cursor: 'pointer' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon || ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <span style={{ opacity: 0.4, fontSize: 12 }}>x</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
