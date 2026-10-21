// Notes & decisions: typed entries with author and date, optional tags, search, filters, sorting and editing.
// Tags stay out of sight until someone uses one: untagged notes show no tag line, and the tag filter appears
// only once a tag exists.
import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteButton } from '../components/Controls';
import { insert, remove, update } from '../data/ops';
import { useChange } from '../data/useChange';
import { fmtD, localDate } from '../lib/dates';
import { newId } from '../lib/ids';
import {
  addTags, filterNotes, MAX_TAG_LENGTH, MAX_TAGS, NOTE_SORTS, sortNotes, tagsInUse, wasEdited, type NoteSort,
} from '../lib/notes';
import { useWedding } from '../state/wedding';
import type { Note, NoteType } from '../types';

const TYPES: NoteType[] = ['decision', 'note', 'question'];
const PILL: Record<NoteType, string> = { decision: 'sage', note: 'terra', question: 'ochre' };

export function Notes() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<NoteSort>('created');

  const author = useMemo(() => {
    const names = new Map(data.members.map((m) => [m.user_id, m.display_name]));
    return (n: Note) => names.get(n.created_by ?? '') ?? t('notes.someone');
  }, [data.members, t]);
  const inUse = tagsInUse(data.notes);
  // A selected tag that no note uses any more drops out of the filter.
  const activeTags = tags.filter((x) => inUse.some((u) => u.tag === x));
  const list = sortNotes(filterNotes(data.notes, { text, type, tags: activeTags }, author), sort);
  const filtering = text.trim() !== '' || type !== 'all' || activeTags.length > 0;
  const toggleTag = (tag: string) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.notes.title')}</h2><p className="muted">{t('sections.notes.intro')}</p></div>
      </div>
      <section className="card stack">
        <NoteForm />
      </section>

      <div className="notes-tools">
        <div className="field notes-search">
          <label htmlFor="noteSearch" className="sr">{t('notes.search')}</label>
          <input id="noteSearch" type="search" value={text} placeholder={t('notes.searchPlaceholder')}
            onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field notes-sort">
          <label htmlFor="noteSort" className="sr">{t('notes.sortBy')}</label>
          <select id="noteSort" value={sort} onChange={(e) => setSort(e.target.value as NoteSort)}>
            {NOTE_SORTS.map((s) => <option key={s} value={s}>{t(`notes.sorts.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="chips" role="group" aria-label={t('notes.filter')}>
        {(['all', ...TYPES] as const).map((x) => (
          <button key={x} type="button" className="chip" aria-pressed={type === x} onClick={() => setType(x)}>
            {x === 'all' ? t('notes.all') : t(`notes.types.${x}`)}
          </button>
        ))}
      </div>
      {inUse.length > 0 && (
        <div className="tag-filter" role="group" aria-label={t('notes.filterTags')}>
          {inUse.map(({ tag, count }) => (
            <button key={tag} type="button" className="tag-btn" aria-pressed={activeTags.includes(tag)}
              aria-label={t('notes.tagFilterLabel', { tag, count })} onClick={() => toggleTag(tag)}>
              #{tag}<span className="tag-count" aria-hidden="true">{count}</span>
            </button>
          ))}
        </div>
      )}

      <section className="card" aria-labelledby="notesListH">
        <div className="row between notes-head">
          <h3 id="notesListH" className="sr">{t('notes.entries')}</h3>
          <p className="muted small" role="status" aria-live="polite">
            {filtering ? t('notes.showing', { count: list.length, total: data.notes.length }) : t('notes.count', { count: data.notes.length })}
          </p>
          {filtering && (
            <button type="button" className="btn small ghost" onClick={() => { setText(''); setType('all'); setTags([]); }}>
              {t('notes.clearFilters')}
            </button>
          )}
        </div>
        {list.length
          ? list.map((n) => <NoteItem key={n.id} n={n} author={author(n)} activeTags={activeTags} onTag={toggleTag} />)
          : <p className="muted">{data.notes.length ? t('notes.noMatch') : t('notes.none')}</p>}
      </section>
    </>
  );
}

function NoteItem({ n, author, activeTags, onTag }: {
  n: Note; author: string; activeTags: string[]; onTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const save = useChange();
  const [editing, setEditing] = useState(false);
  const editBtn = useRef<HTMLButtonElement>(null);

  if (editing) {
    return (
      <div className="note editing">
        <NoteForm note={n} onDone={() => { setEditing(false); requestAnimationFrame(() => editBtn.current?.focus()); }} />
      </div>
    );
  }
  return (
    <div className="note">
      <span className={`pill ${PILL[n.type]}`}>{t(`notes.types.${n.type}`)}</span>
      <div style={{ minWidth: 0 }}>
        <p className="note-body">{n.body}</p>
        {n.tags.length > 0 && (
          <ul className="note-tags" aria-label={t('notes.tags')}>
            {n.tags.map((tag) => (
              <li key={tag}>
                <button type="button" className="tag-inline" aria-pressed={activeTags.includes(tag)}
                  aria-label={t('notes.filterByTag', { tag })} onClick={() => onTag(tag)}>#{tag}</button>
              </li>
            ))}
          </ul>
        )}
        <p className="when">
          {author} · {fmtD(localDate(n.created_at))}
          {wasEdited(n) && <> · {t('notes.edited', { date: fmtD(localDate(n.updated_at), { month: 'short', day: 'numeric' }) })}</>}
        </p>
      </div>
      <div className="note-actions">
        <button ref={editBtn} type="button" className="btn small ghost" aria-label={t('notes.editLabel')} onClick={() => setEditing(true)}>
          {t('common.edit')}
        </button>
        <DeleteButton label={t('notes.deleteLabel')} onConfirm={() => save(remove('notes', n.id), t('notes.deleted'))} />
      </div>
    </div>
  );
}

/** New entry, or editing `note`. */
function NoteForm({ note, onDone }: { note?: Note; onDone?: () => void }) {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const ids = useId();
  const [body, setBody] = useState(note?.body ?? '');
  const [type, setType] = useState<NoteType>(note?.type ?? 'decision');
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const now = new Date().toISOString();
    if (note) {
      if (text !== note.body || type !== note.type || tags.join('\u0000') !== note.tags.join('\u0000')) {
        save(update('notes', note.id, { body: text, type, tags, updated_at: now }), t('notes.saved'));
      }
      onDone?.();
      return;
    }
    save(insert('notes', {
      id: newId(), wedding_id: data.wedding.id, type, body: text, tags, created_by: me.user_id, created_at: now, updated_at: now,
    }), t('notes.saved'));
    setBody('');
    setTags([]);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`${ids}-body`}>{note ? t('notes.editEntry') : t('notes.new')}</label>
        <textarea id={`${ids}-body`} rows={note ? 3 : 2} required maxLength={5000} value={body}
          placeholder={note ? undefined : t('notes.placeholder')} onChange={(e) => setBody(e.target.value)} />
      </div>
      <TagEditor tags={tags} onChange={setTags} />
      <div className="row">
        <label className="sr" htmlFor={`${ids}-type`}>{t('notes.type')}</label>
        <select id={`${ids}-type`} value={type} style={{ width: 'auto' }} onChange={(e) => setType(e.target.value as NoteType)}>
          {TYPES.map((x) => <option key={x} value={x}>{t(`notes.types.${x}`)}</option>)}
        </select>
        <button className="btn primary">{t('common.save')}</button>
        {note && <button type="button" className="btn ghost" onClick={onDone}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

/** Tags as small removable tokens. The input stays tucked away behind "+ Tag" until it's wanted. */
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const suggestions = tagsInUse(data.notes).map((x) => x.tag).filter((x) => !tags.includes(x));
  const full = tags.length >= MAX_TAGS;

  const commit = (value = draft) => {
    if (value.trim()) onChange(addTags(tags, value));
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
    else if (e.key === 'Escape') { setDraft(''); setOpen(false); }
  };

  const showInput = (open || tags.length > 0) && !full;
  return (
    <div className="tag-editor">
      {tags.length > 0 && (
        <ul className="note-tags" aria-label={t('notes.tags')}>
          {tags.map((tag) => (
            <li key={tag}>
              <span className="tag-token">#{tag}
                <button type="button" aria-label={t('notes.removeTag', { tag })} onClick={() => onChange(tags.filter((x) => x !== tag))}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {showInput ? (
        <span className="tag-input">
          <label htmlFor={`${ids}-tag`} className="sr">{t('notes.addTagLabel')}</label>
          <input ref={input} id={`${ids}-tag`} type="text" list={`${ids}-tags`} value={draft} maxLength={MAX_TAG_LENGTH * 3}
            placeholder={t('notes.tagPlaceholder')} autoComplete="off" enterKeyHint="done"
            onChange={(e) => {
              // Picking a suggestion from the list (not typing it) adds it straight away.
              const kind = (e.nativeEvent as InputEvent).inputType;
              const picked = !kind || kind === 'insertReplacementText';
              if (picked && suggestions.includes(e.target.value)) commit(e.target.value);
              else setDraft(e.target.value);
            }}
            onKeyDown={onKey} onBlur={() => commit()} />
          <datalist id={`${ids}-tags`}>{suggestions.map((x) => <option key={x} value={x} />)}</datalist>
        </span>
      ) : !full && (
        <button type="button" className="tag-add" onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}>
          {t('notes.addTag')}
        </button>
      )}
    </div>
  );
}
