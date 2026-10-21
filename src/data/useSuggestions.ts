import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { todayISO } from '../lib/dates';
import { suggestions, type Suggestion } from '../lib/suggestions';
import { useMoney } from '../state/money';
import { useWedding } from '../state/wedding';

/** Today's suggestions for this wedding, with dismissed ones removed. */
export function useSuggestions(): Suggestion[] {
  const { t } = useTranslation();
  const { data, isOwner } = useWedding();
  const money = useMoney();
  return useMemo(() => suggestions(data, { today: todayISO(), money, t, canBudget: isOwner }), [data, money, t, isOwner]);
}
