// One polite live-region toast, as in the prototype.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const Ctx = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [shown, setShown] = useState(false);
  const timer = useRef<number>();
  const toast = useCallback((m: string) => {
    setMessage(m);
    setShown(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(false), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      {/* The region stays mounted so screen readers announce changes to it. */}
      <div className="toast" role="status" aria-live="polite" hidden={!shown}>{shown ? message : ''}</div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
