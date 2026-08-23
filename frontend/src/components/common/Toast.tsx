import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev.slice(-2), { id, title, message, type }]); // Keep at most 2 simultaneous toasts

    setTimeout(() => {
      removeToast(id);
    }, 2800);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Centered Bottom Floating Pill Toasts (Detail 3: No overlap with sidebars) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none select-none max-w-md w-full px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className="pointer-events-auto cursor-pointer flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-xl backdrop-blur-md border border-white/10 dark:border-black/10 transition-all transform animate-in fade-in slide-in-from-bottom-3 duration-200 hover:scale-[1.02]"
          >
            {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600 shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-3.5 h-3.5 text-sky-400 dark:text-sky-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 dark:text-rose-600 shrink-0" />}

            <div className="flex items-center gap-1.5 text-xs font-medium truncate">
              <span className="truncate">{toast.title}</span>
              {toast.message && (
                <>
                  <span className="opacity-40 font-normal">·</span>
                  <span className="opacity-75 font-normal truncate max-w-[180px] sm:max-w-[240px] text-[11px]">
                    {toast.message}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="p-0.5 opacity-50 hover:opacity-100 transition-opacity ml-1 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
