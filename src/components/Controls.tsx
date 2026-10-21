// Small controls shared by several screens.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fromDisplay, inputStep, toDisplay } from '../lib/money';
import { useCurrency } from '../state/currency';
import { useWedding } from '../state/wedding';
import { Icon } from './Icon';

/** A delete button that asks first, inside the page (no window.confirm). */
export function DeleteButton({ label, onConfirm, disabled, question }: {
  label: string; onConfirm: () => void; disabled?: boolean; question?: string;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const trash = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (asking) cancel.current?.focus();
    else if (wasAsking.current) trash.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <button ref={trash} type="button" className="icon-btn del" aria-label={label} disabled={disabled} onClick={() => setAsking(true)}>
        <Icon name="trash" size={16} />
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={label}
      onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); }}>
      <span className="small">{question ?? t('common.deleteQ')}</span>
      <button type="button" className="btn small primary" onClick={() => { setAsking(false); onConfirm(); }}>{t('common.yesDelete')}</button>
      <button ref={cancel} type="button" className="btn small ghost" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
    </span>
  );
}

/**
 * An amount typed in the viewer's display currency (USD or COP), saved as whole USD when they leave the field
 * or press Enter. Empty means "no amount" when `allowEmpty` is set.
 */
export function MoneyInput({ id, usd, onCommit, label, labelHidden, disabled, allowEmpty, className }: {
  id?: string; usd: number | null; onCommit: (usd: number | null) => void; label: string; labelHidden?: boolean;
  disabled?: boolean; allowEmpty?: boolean; className?: string;
}) {
  const { currency } = useCurrency();
  const rate = useWedding().data.wedding.fx_cop_per_usd;
  const autoId = useId();
  const inputId = id ?? autoId;
  const shown = usd === null ? '' : String(toDisplay(usd, currency, rate));
  const [text, setText] = useState(shown);
  const focused = useRef(false);

  // Follow outside changes (a rebalance, a currency switch) unless they're typing.
  useEffect(() => { if (!focused.current) setText(shown); }, [shown]);

  const commit = () => {
    if (text.trim() === '') {
      if (allowEmpty) { if (usd !== null) onCommit(null); } else setText(shown);
      return;
    }
    const next = Math.max(0, fromDisplay(text, currency, rate));
    if (next !== usd) onCommit(next);
    else setText(shown);
  };

  return (
    <>
      <label htmlFor={inputId} className={labelHidden ? 'sr' : undefined}>{label}</label>
      <input id={inputId} className={className} type="number" inputMode="numeric" min={0} step={inputStep(currency)}
        value={text} disabled={disabled}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
    </>
  );
}

export function ViewOnlyBanner({ children }: { children: ReactNode }) {
  return <div className="banner view" role="note"><Icon name="lock" size={18} /><span>{children}</span></div>;
}

/** The prototype's "＋ Add …" disclosure. */
export function AddDisclosure({ label, primary, children, className }: {
  label: string; primary?: boolean; children: (close: () => void) => ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => { if (ref.current) ref.current.open = false; };
  return (
    <details className={`add ${className ?? ''}`} ref={ref}>
      <summary className={`btn small ${primary ? 'primary' : ''}`}><Icon name="plus" size={16} />{label}</summary>
      {children(close)}
    </details>
  );
}
