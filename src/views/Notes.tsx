// Notes & decisions: typed entries with author and date, newest first.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteButton } from '../components/Controls';
import { insert, remove } from '../data/ops';
import { useChange } from '../data/useChange';
import { fmtD, localDate } from '../lib/dates';
import { newId } from '../lib/ids';
import { useWedding } from '../state/wedding';
import type { NoteType } from '../types';

const TYPES: NoteType[] = ['decision', 'note', 'question'];
const PILL: Record<NoteType, string> = { decision: 'sage', note: 'terra', question: 'ochre' };
type Filter = 'all' | NoteType;

export function Notes() {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const [filter, setFilter] = useState<Filter>('all');
  const list = data.notes
    .filter((n) => filter === 'all' || n.type === filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const author = (id: string | null) => data.members.find((m) => m.user_id === id)?.display_name ?? t('notes.someone');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(insert('notes', {
      id: newId(), wedding_id: data.wedding.id, type: String(f.get('type')) as NoteType, body: String(f.get('body')).trim(),
      created_by: me.user_id, created_at: new Date().toISOString(),
    }), t('notes.saved'));
    e.currentTarget.reset();
  };

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.notes.title')}</h2><p className="muted">{t('sections.notes.intro')}</p></div>
      </div>
      <section className="card stack">
        <form className="stack" onSubmit={submit}>
          <div className="field"><label htmlFor="nnText">{t('notes.new')}</label>
            <textarea id="nnText" name="body" rows={2} required maxLength={5000} placeholder={t('notes.placeholder')} /></div>
          <div className="row">
            <label className="sr" htmlFor="nnType">{t('notes.type')}</label>
            <select id="nnType" name="type" style={{ width: 'auto' }}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`notes.types.${x}`)}</option>)}
            </select>
            <button className="btn primary">{t('common.save')}</button>
          </div>
        </form>
      </section>
      <div className="chips" role="group" aria-label={t('notes.filter')}>
        {(['all', ...TYPES] as Filter[]).map((x) => (
          <button key={x} type="button" className="chip" aria-pressed={filter === x} onClick={() => setFilter(x)}>
            {x === 'all' ? t('notes.all') : t(`notes.types.${x}`)}
          </button>
        ))}
      </div>
      <section className="card" aria-label={t('notes.entries')}>
        {list.length ? list.map((n) => (
          <div className="note" key={n.id}>
            <span className={`pill ${PILL[n.type]}`}>{t(`notes.types.${n.type}`)}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
              <p className="when">{author(n.created_by)} · {fmtD(localDate(n.created_at))}</p>
            </div>
            <DeleteButton label={t('notes.deleteLabel')} onConfirm={() => save(remove('notes', n.id), t('notes.deleted'))} />
          </div>
        )) : <p className="muted">{t('notes.none')}</p>}
      </section>
    </>
  );
}
