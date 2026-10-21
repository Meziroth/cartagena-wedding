// Checklist: tasks by month, filters, add, tick off (who and when are recorded by the server), delete.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AddDisclosure, DeleteButton } from '../components/Controls';
import { insert, remove, update } from '../data/ops';
import { useChange } from '../data/useChange';
import { filterTasks, groupByMonth, isOverdue, monthsOut, TASK_AREAS, TASK_FILTERS, type TaskFilter } from '../lib/checklist';
import { fmtD, localDate, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { useWedding } from '../state/wedding';
import type { Assignee, Task } from '../types';

const ASSIGNEES: Assignee[] = ['Both', 'Nick', 'Thuraya', 'Planner'];

export function Checklist() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const [filter, setFilter] = useState<TaskFilter>('All');
  const w = data.wedding;
  const done = data.tasks.filter((x) => x.is_done).length;
  const count = data.tasks.length;
  const pct = count ? Math.round((done / count) * 100) : 0;
  const groups = groupByMonth(filterTasks(data.tasks, filter));

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.checklist.title')}</h2><p className="muted">{t('sections.checklist.intro', { date: fmtD(w.wedding_date) })}</p></div>
      </div>
      <div className="card stack">
        <div className="row between"><b className="num">{t('checklist.doneOf', { done, count })}</b><span className="muted num">{pct}%</span></div>
        <div className="bar" role="img" aria-label={t('home.tasksBar', { pct })}><i className="paid" style={{ width: `${pct}%` }} /></div>
        <div className="chips" role="group" aria-label={t('checklist.filter')}>
          {TASK_FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`checklist.filters.${f}`)}</button>
          ))}
        </div>
        <AddTask />
      </div>
      {groups.length ? groups.map(([month, items]) => {
        const m = monthsOut(month, w.wedding_date);
        return (
          <section className="card" key={month} aria-label={fmtD(`${month}-01`, { month: 'long', year: 'numeric' })}>
            <div className="month">
              <h3>{fmtD(`${month}-01`, { month: 'long', year: 'numeric' })}</h3>
              <span className="label">{m > 0 ? t('checklist.monthsOut', { count: m }) : m === 0 ? t('checklist.weddingMonth') : ''}</span>
            </div>
            {items.map((x) => <TaskRow key={x.id} x={x} />)}
          </section>
        );
      }) : <div className="empty">{t('checklist.noMatch')}</div>}
    </>
  );
}

export function TaskRow({ x }: { x: Task }) {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const late = isOverdue(x, todayISO());
  const id = `tk-${x.id}`;
  const doneBy = x.done_by ? data.members.find((m) => m.user_id === x.done_by)?.display_name : null;

  const toggle = (checked: boolean) => save(update('tasks', x.id, {
    is_done: checked, done_by: checked ? me.user_id : null, done_at: checked ? new Date().toISOString() : null,
  }));

  return (
    <div className={`task ${x.is_done ? 'done' : ''}`}>
      <input type="checkbox" className="check" id={id} checked={x.is_done} onChange={(e) => toggle(e.target.checked)}
        aria-label={t('checklist.doneLabel', { title: x.title })} />
      <div style={{ minWidth: 0 }}>
        <label htmlFor={id} className="t-title" style={{ cursor: 'pointer' }}>{x.title}</label>
        <div className="t-meta">
          <span style={late ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>{late && t('home.overdue')}{fmtD(x.due_date)}</span>
          <span>{t(`checklist.assignee.${x.assignee}`)}</span>
          <span>{x.area}</span>
          {x.is_done && x.done_at && (
            <span>{doneBy ? t('checklist.doneBy', { name: doneBy, date: fmtD(localDate(x.done_at), { month: 'short', day: 'numeric' }) })
              : t('checklist.doneOn', { date: fmtD(localDate(x.done_at), { month: 'short', day: 'numeric' }) })}</span>
          )}
        </div>
      </div>
      <DeleteButton label={t('checklist.deleteTask', { title: x.title })}
        onConfirm={() => save(remove('tasks', x.id), t('checklist.deleted'))} />
    </div>
  );
}

function AddTask() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const save = useChange();

  const submit = (e: FormEvent<HTMLFormElement>, close: () => void) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(insert('tasks', {
      id: newId(), wedding_id: data.wedding.id, title: String(f.get('title')).trim(), area: String(f.get('area')),
      assignee: String(f.get('who')) as Assignee, due_date: String(f.get('due')), is_done: false, done_by: null, done_at: null,
      months_before: null, sort: Math.max(0, ...data.tasks.map((x) => x.sort)) + 1,
    }), t('checklist.added'));
    e.currentTarget.reset();
    close();
  };

  return (
    <AddDisclosure label={t('checklist.add')} primary>
      {(close) => (
        <form className="formgrid" onSubmit={(e) => submit(e, close)}>
          <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor="ntTitle">{t('checklist.task')}</label>
            <input type="text" id="ntTitle" name="title" required maxLength={300} placeholder={t('checklist.taskPlaceholder')} /></div>
          <div className="field"><label htmlFor="ntDue">{t('checklist.due')}</label>
            <input type="date" id="ntDue" name="due" required defaultValue={todayISO()} /></div>
          <div className="field"><label htmlFor="ntWho">{t('checklist.who')}</label>
            <select id="ntWho" name="who">{ASSIGNEES.map((a) => <option key={a} value={a}>{t(`checklist.assignee.${a}`)}</option>)}</select></div>
          <div className="field"><label htmlFor="ntArea">{t('checklist.area')}</label>
            <select id="ntArea" name="area">{TASK_AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
          <button className="btn primary">{t('common.add')}</button>
        </form>
      )}
    </AddDisclosure>
  );
}
