// Placeholder screens for Phase 1: the prototype's section header plus a summary of the data behind it.
// Each one is replaced by the real screen in Phase 4–5.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { RouteId } from '../app/routes';
import { plannedTotal, activeCategories } from '../lib/budget';
import { fmtD } from '../lib/dates';
import { sum } from '../lib/sum';
import { useMoney } from '../state/money';
import { useWedding } from '../state/wedding';

type SectionId = Exclude<RouteId, 'home'>;

export function Section({ id }: { id: SectionId }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const money = useMoney();
  const w = data.wedding;

  const summary: Record<SectionId, string> = {
    checklist: t('sections.summary.checklist', { done: data.tasks.filter((x) => x.is_done).length, count: data.tasks.length }),
    budget: t('sections.summary.budget', {
      planned: money(plannedTotal(data.budget_categories, data.events)),
      count: activeCategories(data.budget_categories, data.events).length,
    }),
    vendors: t('sections.summary.vendors', { count: data.vendors.length }),
    inspiration: t('sections.summary.inspiration', { count: data.ideas.length }),
    guests: t('sections.summary.guests', { people: sum(data.guests, (g) => g.party_size), count: data.guests.length }),
    notes: t('sections.summary.notes', { count: data.notes.length }),
    details: t('sections.summary.details'),
  };

  return (
    <>
      <div className="sec-head">
        <div>
          <h2>{t(`sections.${id}.title`)}</h2>
          <p className="muted">{t(`sections.${id}.intro`, { date: fmtD(w.wedding_date), n: w.guest_target })}</p>
        </div>
      </div>
      <div className="empty">{t('sections.comingSoon', { summary: summary[id] })}</div>
    </>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return (
    <>
      <div className="sec-head"><div><h2>{t('notFound.title')}</h2><p className="muted">{t('notFound.body')}</p></div></div>
      <p><Link className="btn primary" to="/">{t('notFound.home')}</Link></p>
    </>
  );
}
