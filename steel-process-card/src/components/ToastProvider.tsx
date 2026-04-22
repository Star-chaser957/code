import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'info' | 'warning' | 'error';

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  pushToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast: (input) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const next: ToastItem = {
          id,
          tone: input.tone ?? 'success',
          title: input.title,
          description: input.description,
        };

        setItems((current) => [...current, next]);

        window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== id));
        }, 3200);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`}>
            <strong>{item.title}</strong>
            {item.description ? <p>{item.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
