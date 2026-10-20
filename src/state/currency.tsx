// Display currency (USD or COP), remembered per signed-in user in localStorage. Storage is always whole USD.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Currency } from '../types';

const keyFor = (userId: string) => `nt-currency:${userId}`;

function read(userId: string): Currency {
  try {
    return localStorage.getItem(keyFor(userId)) === 'COP' ? 'COP' : 'USD';
  } catch {
    return 'USD';
  }
}

interface CurrencyCtx { currency: Currency; setCurrency: (c: Currency) => void }
const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [currency, setState] = useState<Currency>(() => read(userId));
  const setCurrency = useCallback((c: Currency) => {
    setState(c);
    try { localStorage.setItem(keyFor(userId), c); } catch { /* keep for this session only */ }
  }, [userId]);
  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCurrency must be used inside CurrencyProvider');
  return v;
}
