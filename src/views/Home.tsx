import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon, TilesBackground } from '../components/Icon';
import { useFileUrls } from '../data/queries';
import { paidTotal, plannedTotal } from '../lib/budget';
import { daysBetween, fmtD, todayISO } from '../lib/dates';
import { sum } from '../lib/sum';
import { useMoney } from '../state/money';
import { useWedding } from '../state/wedding';
import { IdeaMedia } from './Inspiration';

const linkCard = { textDecoration: 'none', color: 'inherit' } as const;

export function Home() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const money = useMoney();
  const { wedding: w, tasks, payments, guests, ideas, idea_votes, members } = data;
  const today = todayISO();

  const days = Math.max(0, daysBetween(today, w.wedding_date));
  const total = w.total_budget_usd;
  const plan = plannedTotal(data.budget_categories, data.events);
  const paid = paidTotal(payments, data.budget_categories, data.events);
  const done = tasks.filter((x) => x.is_done).length;
  const next = tasks.filter((x) => !x.is_done).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
  const pays = payments.filter((p) => !p.is_paid).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 3);
  const yes = sum(guests.filter((g) => g.rsvp === 'Yes'), (g) => g.party_size);
  const invited = sum(guests, (g) => g.party_size);
  const owners = members.filter((m) => m.role === 'owner').map((m) => m.user_id);
  const loved = ideas
    .filter((i) => owners.length > 0 && owners.every((u) => idea_votes.some((v) => v.idea_id === i.id && v.user_id === u)))
    .slice(0, 4);
  const lovedUrls = useFileUrls('inspiration', loved.flatMap((i) => (i.storage_path ? [i.storage_path] : [])));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <>
      <section className="hero" aria-labelledby="heroNames">
        <TilesBackground />
        <div className="hero-inner">
          <div>
            <p className="label">{t('home.weddingOf')}</p>
            <h1 className="names" id="heroNames">Nick <span className="amp">&amp;</span> Thuraya</h1>
            <div className="where">
              <span>{t('app.place')}</span>
              <span>{t('app.venue')}</span>
              <span>
                {fmtD(w.wedding_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{' '}
                {w.date_confirmed
                  ? <span className="pill sage">{t('home.confirmed')}</span>
                  : <span className="pill ochre">{t('home.target')}</span>}
              </span>
            </div>
          </div>
          <div className="count"><b className="num">{days}</b><span className="label">{t('home.daysToGo')}</span></div>
        </div>
      </section>

      <div className="grid g3">
        <Link className="card stat" to="/budget" style={linkCard}>
          <p className="label">{t('home.budgetPlanned')}</p><b className="num">{money(plan, true)}</b>
          <p className="muted num" style={{ fontSize: '.88rem' }}>{t('home.budgetOf', { total: money(total, true), paid: money(paid, true) })}</p>
          <div className="bar" role="img" aria-label={t('home.budgetBar', { pct: pct(plan, total) })}>
            <i style={{ width: `${Math.min(100, pct(plan, total))}%` }} />
          </div>
        </Link>
        <Link className="card stat" to="/checklist" style={linkCard}>
          <p className="label">{t('home.checklist')}</p><b className="num">{done} / {tasks.length}</b>
          <p className="muted" style={{ fontSize: '.88rem' }}>{t('home.tasksDone')}</p>
          <div className="bar" role="img" aria-label={t('home.tasksBar', { pct: pct(done, tasks.length) })}>
            <i className="paid" style={{ width: `${pct(done, tasks.length)}%` }} />
          </div>
        </Link>
        <Link className="card stat" to="/guests" style={linkCard}>
          <p className="label">{t('home.guests')}</p><b className="num">{t('home.guestsPlanned', { n: w.guest_target })}</b>
          <p className="muted num" style={{ fontSize: '.88rem' }}>{t('home.guestsSub', { invited, yes })}</p>
          <div className="bar" role="img" aria-label={t('home.guestsBar', { yes, target: w.guest_target })}>
            <i className="paid" style={{ width: `${Math.min(100, pct(yes, w.guest_target))}%` }} />
          </div>
        </Link>
      </div>

      <div className="grid g2">
        <section className="card" aria-labelledby="sgH">
          <div className="row between" style={{ marginBottom: 14 }}><h3 id="sgH">{t('home.suggestions')}</h3></div>
          {/* TODO(phase 6): src/lib/suggestions.ts */}
          <p className="muted">{t('home.suggestionsSoon')}</p>
        </section>
        <div className="stack" style={{ gap: 16 }}>
          <section className="card" aria-labelledby="nxH">
            <div className="row between" style={{ marginBottom: 6 }}>
              <h3 id="nxH">{t('home.upNext')}</h3>
              <Link to="/checklist" className="btn small ghost">{t('home.fullChecklist')}</Link>
            </div>
            <div>
              {next.length ? next.map((x) => {
                const late = x.due_date < today;
                return (
                  <div className="task" key={x.id}>
                    <span className="muted"><Icon name="checklist" size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <span className="t-title">{x.title}</span>
                      <div className="t-meta">
                        <span style={late ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>{late ? t('home.overdue') : ''}{fmtD(x.due_date)}</span>
                        <span>{x.assignee}</span><span>{x.area}</span>
                      </div>
                    </div>
                    <span />
                  </div>
                );
              }) : <p className="muted">{t('home.allCaughtUp')}</p>}
            </div>
          </section>
          <section className="card" aria-labelledby="pyH">
            <div className="row between" style={{ marginBottom: 6 }}><h3 id="pyH">{t('home.payments')}</h3></div>
            {pays.length ? pays.map((p) => (
              <div className="pay" key={p.id}>
                <span><Icon name="cal" size={18} /></span>
                <div>
                  <b>{p.label}</b>
                  <div className="t-meta"><span className="num" style={p.due_date < today ? { color: 'var(--alert)' } : undefined}>{fmtD(p.due_date)}</span></div>
                </div>
                <b className="num">{money(p.amount_usd)}</b><span />
              </div>
            )) : <p className="muted">{t('home.noPayments')}</p>}
          </section>
        </div>
      </div>

      <section className="card" aria-labelledby="viH">
        <div className="row between">
          <div>
            <p className="label">{t('home.vision')}</p>
            <h3 id="viH" style={{ marginTop: 4, fontSize: '1.5rem', fontStyle: 'italic' }}>{t('home.visionTitle')}</h3>
          </div>
          <Link className="btn small" to="/inspiration">{t('home.openBoard')}</Link>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,140px),1fr))', marginTop: 16 }}>
          {loved.map((i) => (
            <div key={i.id} className="vision-thumb">
              <IdeaMedia idea={i} square url={i.storage_path ? lovedUrls.data?.[i.storage_path] : undefined} />
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.85rem', marginTop: 10 }}>{t('home.visionNote')}</p>
      </section>
    </>
  );
}
