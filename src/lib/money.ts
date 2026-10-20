import type { Currency } from '../types';

const usdF = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const copF = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cmpF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatUSD = (usd: number): string => usdF.format(Math.round(usd));
/** es-CO grouping: COP 47.916.600 */
export const formatCOPNumber = (cop: number): string => copF.format(Math.round(cop));

export function formatMoney(usd: number, currency: Currency, rate: number, short = false): string {
  if (currency === 'COP') {
    const v = usd * rate;
    return short && Math.abs(v) >= 1e6 ? 'COP ' + cmpF.format(v) : 'COP ' + formatCOPNumber(v);
  }
  return formatUSD(usd);
}

/** USD → the number shown in an input for the chosen currency. */
export const toDisplay = (usd: number, currency: Currency, rate: number): number =>
  currency === 'COP' ? Math.round(usd * rate) : Math.round(usd);

/** Input value in the chosen currency → whole USD for storage. */
export const fromDisplay = (value: number | string, currency: Currency, rate: number): number => {
  const n = Number(value) || 0;
  return Math.round(currency === 'COP' ? n / rate : n);
};

export const inputStep = (currency: Currency): number => (currency === 'COP' ? 10000 : 10);
