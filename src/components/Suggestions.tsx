// The suggestion cards, with their one-tap actions and a dismiss button. Used on Home and Budget.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { pathOf } from '../app/routes';
import { insert } from '../data/ops';
import { useChange } from '../data/useChange';
import { bufferCategory, budgetStatus, plannedTotal, raiseBuffer, rebalance } from '../lib/budget';
import { todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import type { Suggestion } from '../lib/suggestions';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import { Icon } from './Icon';

function useRunAction() {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const toast = useToast();
  const navigate = useNavigate();
  const w = data.wedding;

  return (a: NonNullable<Suggestion['action']>) => {
    switch (a.kind) {
      case 'go': return navigate(pathOf(a.route));
      case 'rebalance': {
        const r = rebalance(w.total_budget_usd, data.budget_categories, data.events);
        return r.ok ? save({ type: 'saveBudget', weddingId: w.id, total: null, amounts: r.amounts }, t('budget.rebalanced'))
          : toast(t(`budget.refuse.${r.reason}`));
      }
      case 'toBuffer': {
        const buffer = bufferCategory(data.budget_categories);
        const s = budgetStatus(w.total_budget_usd, plannedTotal(data.budget_categories, data.events));
        if (!buffer || s.kind !== 'under') return;
        return save({ type: 'saveBudget', weddingId: w.id, total: null, amounts: { [buffer.id]: buffer.amount_usd + s.by } }, t('budget.addedToBuffer'));
      }
      case 'buffer7': {
        const r = raiseBuffer(w.total_budget_usd, data.budget_categories, data.events, 0.07);
        return r.ok ? save({ type: 'saveBudget', weddingId: w.id, total: null, amounts: r.amounts }, t('suggest.bufferRaised'))
          : toast(t(`budget.refuse.${r.reason}`));
      }
      case 'task':
        return save(insert('tasks', {
          id: newId(), wedding_id: w.id, title: a.title, area: 'Planning', assignee: 'Both', due_date: todayISO(),
          is_done: false, done_by: null, done_at: null, months_before: null, sort: Math.max(0, ...data.tasks.map((x) => x.sort)) + 1,
        }), t('suggest.taskAdded'));
      case 'note': {
        const now = new Date().toISOString();
        return save(insert('notes', {
          id: newId(), wedding_id: w.id, type: 'question', body: a.text, tags: [], created_by: me.user_id, created_at: now, updated_at: now,
        }), t('suggest.noteAdded'));
      }
    }
  };
}

export function SuggestionList({ list }: { list: Suggestion[] }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const save = useChange();
  const run = useRunAction();

  if (!list.length) return <p className="muted">{t('home.nothingToFlag')}</p>;
  return (
    <div>
      {list.map((s) => (
        <div className="sugg" data-tone={s.tone} key={s.key}>
          <span className="dot"><Icon name={s.tone === 'tip' ? 'spark' : 'warn'} size={18} /></span>
          <div>
            <h4>{s.title}</h4>
            <p>{s.body}</p>
            {s.action && <div className="row"><button type="button" className="btn small" onClick={() => run(s.action!)}>{s.action.label}</button></div>}
          </div>
          <button type="button" className="icon-btn" aria-label={t('suggest.dismiss', { title: s.title })}
            onClick={() => save(insert('dismissed_suggestions', { wedding_id: data.wedding.id, suggestion_key: s.key }), t('suggest.dismissed'))}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
