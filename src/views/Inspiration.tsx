// Inspiration: photos (shrunk in the browser, stored privately) and saved links with real previews, hearts from
// Nick and Thuraya, filters and sorting, in a masonry board as in the prototype.
import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteButton } from '../components/Controls';
import { Icon } from '../components/Icon';
import { insert, remove, update, type Op } from '../data/ops';
import { useFileUrls } from '../data/queries';
import { dataSource } from '../data/source';
import { useChange, useChangeErrorMessage } from '../data/useChange';
import { newId } from '../lib/ids';
import {
  boardIdeas, bothLove, heartsFor, hostOf, IDEA_FILTERS, IDEA_TAGS, normalizeUrl, ownerIds, type IdeaFilter, type IdeaSort,
} from '../lib/ideas';
import { ImageError, resizeImage } from '../lib/resizeImage';
import { MOCK_ART } from '../mock/mockData';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import type { Idea, IdeaTag } from '../types';

export function Inspiration() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const [filter, setFilter] = useState<IdeaFilter>('All');
  const [sort, setSort] = useState<IdeaSort>('new');
  const owners = ownerIds(data.members);
  const list = boardIdeas(data.ideas, data.idea_votes, owners, filter, sort);
  const urls = useFileUrls('inspiration', data.ideas.flatMap((i) => (i.kind === 'image' && i.storage_path ? [i.storage_path] : [])));

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.inspiration.title')}</h2><p className="muted">{t('sections.inspiration.intro')}</p></div>
      </div>
      <AddInspiration />
      <div className="row between">
        <div className="chips" role="group" aria-label={t('ideas.filter')}>
          {IDEA_FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'Both love' && <Icon name="heart" size={14} />}{t(`ideas.filters.${f}`)}
            </button>
          ))}
        </div>
        <label className="row" style={{ gap: 8, fontSize: '.85rem' }}>
          <span className="muted">{t('ideas.sort')}</span>
          <select value={sort} style={{ width: 'auto' }} onChange={(e) => setSort(e.target.value as IdeaSort)}>
            <option value="new">{t('ideas.sortNew')}</option>
            <option value="loved">{t('ideas.sortLoved')}</option>
          </select>
        </label>
      </div>
      {list.length
        ? <div className="board">{list.map((i) => <IdeaCard key={i.id} idea={i} url={i.storage_path ? urls.data?.[i.storage_path] : undefined} />)}</div>
        : <div className="empty">{data.ideas.length ? t('ideas.noMatch') : t('ideas.none')}</div>}
    </>
  );
}

function AddInspiration() {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const toast = useToast();
  const message = useChangeErrorMessage();
  const ids = useId();
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<IdeaTag>('Venue');
  const [link, setLink] = useState('');
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const base = () => ({
    id: newId(), wedding_id: data.wedding.id, title: title.trim(), tag, storage_path: null, url: null,
    preview_title: null, preview_image_url: null, created_by: me.user_id, created_at: new Date().toISOString(),
  });

  const saveLink = async (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(link);
    if (!url) return toast(link.trim() ? t('ideas.badLink') : t('ideas.needLink'));
    const row: Idea = { ...base(), kind: 'link', url };
    save(insert('ideas', row), t('ideas.linkSaved'));
    setLink('');
    setTitle('');
    // The card shows the site's name at once; the real preview fills in when the server has read the page.
    const p = await dataSource.linkPreview(url);
    if (p.title || p.image) save(update('ideas', row.id, { preview_title: p.title, preview_image_url: p.image }));
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return toast(t('ideas.notImages'));
    setProgress({ done: 0, total: images.length });
    let failed = 0;
    let lastError: unknown = null;
    for (const [n, file] of images.entries()) {
      try {
        const jpeg = await resizeImage(file);
        const path = await dataSource.uploadFile('inspiration', data.wedding.id, jpeg, 'jpg');
        const op: Op = insert('ideas', { ...base(), kind: 'image', storage_path: path });
        save(op);
      } catch (e) {
        failed++;
        lastError = e;
      }
      setProgress({ done: n + 1, total: images.length });
    }
    setProgress(null);
    setTitle('');
    if (fileInput.current) fileInput.current.value = '';
    const added = images.length - failed;
    if (!failed) toast(t('ideas.photosAdded', { count: added }));
    else if (lastError instanceof ImageError) toast(t('ideas.photosUnreadable', { count: failed }));
    else toast(added ? t('ideas.photosPartly', { added, failed }) : message(lastError));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void addFiles([...e.dataTransfer.files]);
  };

  return (
    <section className="card stack" aria-labelledby="addIdeaH">
      <h3 id="addIdeaH">{t('ideas.addTitle')}</h3>
      <form className="formgrid" onSubmit={(e) => void saveLink(e)}>
        <div className="field"><label htmlFor={`${ids}-title`}>{t('ideas.caption')}</label>
          <input type="text" id={`${ids}-title`} value={title} maxLength={200} placeholder={t('ideas.captionPlaceholder')}
            onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label htmlFor={`${ids}-tag`}>{t('ideas.category')}</label>
          <select id={`${ids}-tag`} value={tag} onChange={(e) => setTag(e.target.value as IdeaTag)}>
            {IDEA_TAGS.map((x) => <option key={x} value={x}>{t(`ideas.tags.${x}`)}</option>)}
          </select></div>
        <div className="field" style={{ gridColumn: 'span 2', minWidth: 'min(100%,260px)' }}>
          <label htmlFor={`${ids}-url`}>{t('ideas.link')}</label>
          <input type="text" id={`${ids}-url`} value={link} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://pin.it/…" onChange={(e) => setLink(e.target.value)} /></div>
        <button className="btn primary">{t('ideas.saveLink')}</button>
      </form>
      <div className={`drop ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <Icon name="upload" size={22} />
        <p><b>{t('ideas.uploadTitle')}</b></p>
        <p className="small">{t('ideas.uploadHint')}</p>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles([...(e.target.files ?? [])])} />
        <button type="button" className="btn small" disabled={!!progress} onClick={() => fileInput.current?.click()}>
          {t('ideas.choosePhotos')}
        </button>
        <p className="small" role="status" aria-live="polite">
          {progress ? t('ideas.uploading', { done: progress.done, total: progress.total }) : ''}
        </p>
      </div>
    </section>
  );
}

/** The picture part of an idea: uploaded photo, link preview, site card, or example artwork. */
export function IdeaMedia({ idea, url, square }: { idea: Idea; url?: string; square?: boolean }) {
  const { t } = useTranslation();
  const alt = idea.title || idea.preview_title || t('ideas.photoAlt');
  const art = MOCK_ART[idea.id];
  if (art) {
    return <div className={`img ${art.art} ${square ? 'square' : art.shape}`} role="img" aria-label={alt}>
      {!square && <span className="art-tag">{t('ideas.sample')}</span>}</div>;
  }
  if (idea.kind === 'image') {
    return url
      ? <img src={url} alt={alt} loading="lazy" decoding="async" className={square ? 'square' : undefined} />
      : <div className={`img loading ${square ? 'square' : ''}`} role="img" aria-label={alt} />;
  }
  const host = hostOf(idea.url);
  if (idea.preview_image_url) {
    return (
      <a href={idea.url ?? undefined} target="_blank" rel="noopener noreferrer" className="link-img">
        {/* Hotlinked from the other site; no-referrer keeps our address out of their logs. */}
        <img src={idea.preview_image_url} alt={idea.preview_title || alt} loading="lazy" referrerPolicy="no-referrer"
          className={square ? 'square' : undefined} />
        {!square && <span className="link-host"><Icon name="link" size={14} />{host}</span>}
      </a>
    );
  }
  return (
    <a className={`link-art ${square ? 'square' : ''}`} href={idea.url ?? undefined} target="_blank" rel="noopener noreferrer">
      <Icon name="link" size={26} /><b>{host || t('ideas.link')}</b>
      {!square && <span style={{ fontSize: '.8rem' }}>{t('ideas.openOriginal')}</span>}
    </a>
  );
}

function IdeaCard({ idea, url }: { idea: Idea; url?: string }) {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const save = useChange();
  const owners = data.members.filter((m) => m.role === 'owner');
  const hearts = heartsFor(idea.id, data.idea_votes);
  const both = bothLove(idea.id, data.idea_votes, ownerIds(data.members));
  const title = idea.title || idea.preview_title || (idea.kind === 'link' ? hostOf(idea.url) : '') || t('ideas.untitled');

  const toggleHeart = () => {
    const match = { idea_id: idea.id, user_id: me.user_id };
    save(hearts.has(me.user_id) ? { type: 'delete', table: 'idea_votes', match } : insert('idea_votes', match));
  };

  return (
    <figure className="idea">
      <IdeaMedia idea={idea} url={url} />
      <figcaption className="cap">
        <b>{title}</b>
        <div className="row between" style={{ gap: 8 }}>
          <span className="pill terra">{t(`ideas.tags.${idea.tag}`)}</span>
          {both && <span className="pill pink">{t('ideas.bothLove')}</span>}
        </div>
        <div className="row between" style={{ gap: 6 }}>
          <div className="hearts">
            {owners.map((o) => {
              const mine = o.user_id === me.user_id;
              const on = hearts.has(o.user_id);
              return (
                <button key={o.user_id} type="button" className="heart" aria-pressed={on} disabled={!mine} onClick={toggleHeart}
                  aria-label={t(on ? 'ideas.loves' : 'ideas.notHearted', { name: o.display_name }) + (mine ? t('ideas.toggleHeart') : '')}>
                  <Icon name="heart" size={14} width={2} />{o.display_name}
                </button>
              );
            })}
          </div>
          <DeleteButton label={t('ideas.deleteLabel', { title })} onConfirm={() => {
            save(remove('ideas', idea.id), t('ideas.deleted'));
            if (idea.storage_path) void dataSource.deleteFile('inspiration', idea.storage_path).catch(() => {});
          }} />
        </div>
      </figcaption>
    </figure>
  );
}
