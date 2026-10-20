import { useCallback } from 'react';
import { formatMoney } from '../lib/money';
import { useCurrency } from './currency';
import { useWedding } from './wedding';

/** Formats whole USD in the viewer's chosen display currency. */
export function useMoney(): (usd: number, short?: boolean) => string {
  const { currency } = useCurrency();
  const rate = useWedding().data.wedding.fx_cop_per_usd;
  return useCallback((usd: number, short = false) => formatMoney(usd, currency, rate, short), [currency, rate]);
}
