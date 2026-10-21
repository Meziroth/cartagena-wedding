// Vendors: from first message to final payment, with the quote checked against its budget category and an
// optional contract PDF in private storage.
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AddDisclosure, DeleteButton } from '../components/Controls';
import { Icon } from '../components/Icon';
import { insert, remove, update } from '../data/ops';
import { dataSource } from '../data/source';
import { useChange, useChangeErrorMessage } from '../data/useChange';
import { activeCategories } from '../lib/budget';
import { newId } from '../lib/ids';
import { fromDisplay, inputStep, toDisplay } from '../lib/money';
import { useCurrency } from '../state/currency';
import { useMoney } from '../state/money';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import type { Vendor } from '../types';

const VENDOR_STATUSES = [0, 1, 2, 3, 4] as const;
const MAX_CONTRACT_MB = 20;

export function Vendors() {
  const { t } = useTranslation();
  const { data } = useWedding();
  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.vendors.title')}</h2><p className="muted">{t('sections.vendors.intro')}</p></div>
      </div>
      <AddDisclosure label={t('vendors.add')} primary className="card">
        {(close) => <VendorForm onDone={close} />}
      </AddDisclosure>
      {data.vendors.length
        ? <div className="grid g2">{data.vendors.map((v) => <VendorCard key={v.id} v={v} />)}</div>
        : <div className="empty">{t('vendors.none')}</div>}
    </>
  );
}

/** Adds a vendor, or edits one when `v` is given. */
function VendorForm({ v, onDone }: { v?: Vendor; onDone: () => void }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const { currency } = useCurrency();
  const save = useChange();
  const rate = data.wedding.fx_cop_per_usd;
  const cats = activeCategories(data.budget_categories, data.events);
  const p = v ? `ev-${v.id}` : 'nv';

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const quote = String(f.get('quote')).trim();
    const fields = {
      name: String(f.get('name')).trim(),
      category_id: String(f.get('cat')) || null,
      status: Number(f.get('status')),
      quote_usd: quote === '' ? null : Math.max(0, fromDisplay(quote, currency, rate)),
      contact: String(f.get('contact')).trim(),
      notes: String(f.get('notes')).trim(),
    };
    if (v) save(update('vendors', v.id, fields), t('vendors.saved'));
    else {
      save(insert('vendors', { id: newId(), wedding_id: data.wedding.id, contract_path: null, ...fields }), t('vendors.added'));
      e.currentTarget.reset();
    }
    onDone();
  };

  return (
    <form className="formgrid" onSubmit={submit}>
      <div className="field"><label htmlFor={`${p}Name`}>{t('vendors.name')}</label>
        <input type="text" id={`${p}Name`} name="name" required maxLength={200} defaultValue={v?.name} /></div>
      <div className="field"><label htmlFor={`${p}Cat`}>{t('vendors.category')}</label>
        <select id={`${p}Cat`} name="cat" defaultValue={v?.category_id ?? ''}>
          <option value="">{t('vendors.noCategory')}</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor={`${p}Status`}>{t('vendors.status')}</label>
        <select id={`${p}Status`} name="status" defaultValue={v?.status ?? 0}>
          {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{t(`vendors.statuses.${s}`)}</option>)}
        </select></div>
      <div className="field"><label htmlFor={`${p}Quote`}>{t('vendors.quoteIn', { currency })}</label>
        <input type="number" id={`${p}Quote`} name="quote" min={0} step={inputStep(currency)}
          defaultValue={v?.quote_usd == null ? '' : toDisplay(v.quote_usd, currency, rate)} /></div>
      <div className="field"><label htmlFor={`${p}Contact`}>{t('vendors.contact')}</label>
        <input type="text" id={`${p}Contact`} name="contact" maxLength={300} placeholder={t('vendors.contactPlaceholder')} defaultValue={v?.contact} />
        <span className="muted small">{t('vendors.whatsapp')}</span></div>
      <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor={`${p}Notes`}>{t('vendors.notes')}</label>
        <textarea id={`${p}Notes`} name="notes" rows={2} maxLength={5000} defaultValue={v?.notes} /></div>
      <div className="row">
        <button className="btn primary">{v ? t('common.save') : t('vendors.addButton')}</button>
        {v && <button type="button" className="btn ghost" onClick={onDone}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

function VendorCard({ v }: { v: Vendor }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const money = useMoney();
  const save = useChange();
  const [editing, setEditing] = useState(false);
  const cat = data.budget_categories.find((c) => c.id === v.category_id);
  const over = cat && v.quote_usd !== null && v.quote_usd > cat.amount_usd ? v.quote_usd - cat.amount_usd : 0;

  return (
    <article className="card vendor" aria-labelledby={`vn-${v.id}`}>
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 id={`vn-${v.id}`}>{v.name}</h3>
          <p className="muted small">{cat?.name ?? t('vendors.noCategory')}</p>
        </div>
        <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          {!editing && <button type="button" className="btn small ghost" onClick={() => setEditing(true)}
            aria-label={t('vendors.editLabel', { name: v.name })}>{t('common.edit')}</button>}
          <DeleteButton label={t('vendors.deleteLabel', { name: v.name })} onConfirm={() => {
            if (v.contract_path) void dataSource.deleteFile('contracts', v.contract_path).catch(() => {});
            save(remove('vendors', v.id), t('vendors.deleted'));
          }} />
        </div>
      </div>
      <div className="steps" role="img" aria-label={t('vendors.stepLabel', { step: v.status + 1, status: t(`vendors.statuses.${v.status}`) })}>
        {VENDOR_STATUSES.map((s) => <i key={s} className={s <= v.status ? 'on' : ''} />)}
      </div>
      {editing ? (
        <div style={{ marginTop: 14 }}><VendorForm v={v} onDone={() => setEditing(false)} /></div>
      ) : (
        <>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor={`vs-${v.id}`}>{t('vendors.status')}</label>
            <select id={`vs-${v.id}`} value={v.status} onChange={(e) => save(update('vendors', v.id, { status: Number(e.target.value) }))}>
              {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{t(`vendors.statuses.${s}`)}</option>)}
            </select>
          </div>
          <dl>
            {v.quote_usd !== null && <>
              <dt>{t('vendors.quote')}</dt>
              <dd className="num">{money(v.quote_usd)}{over > 0 && <> <span className="pill alert">{t('vendors.overCategory', { amount: money(over) })}</span></>}</dd>
            </>}
            {v.contact && <><dt>{t('vendors.contact')}</dt><dd>{v.contact}</dd></>}
            {v.notes && <><dt>{t('vendors.notes')}</dt><dd>{v.notes}</dd></>}
          </dl>
          <Contract v={v} />
        </>
      )}
    </article>
  );
}

function Contract({ v }: { v: Vendor }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const save = useChange();
  const toast = useToast();
  const message = useChangeErrorMessage();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return toast(t('vendors.contractPdfOnly'));
    if (file.size > MAX_CONTRACT_MB * 1024 * 1024) return toast(t('vendors.contractTooBig', { mb: MAX_CONTRACT_MB }));
    setBusy(true);
    try {
      const path = await dataSource.uploadFile('contracts', data.wedding.id, file, 'pdf');
      const old = v.contract_path;
      save(update('vendors', v.id, { contract_path: path }), t('vendors.contractSaved'));
      if (old) void dataSource.deleteFile('contracts', old).catch(() => {});
    } catch (e) {
      toast(message(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const open = async () => {
    // Open the tab first, so pop-up blockers allow it, then point it at the signed address.
    const tab = window.open('', '_blank');
    try {
      const url = await dataSource.fileUrl('contracts', v.contract_path!);
      if (tab) { tab.opener = null; tab.location.href = url; } else window.location.assign(url);
    } catch (e) {
      tab?.close();
      toast(message(e));
    }
  };

  const removeContract = () => {
    const path = v.contract_path!;
    save(update('vendors', v.id, { contract_path: null }), t('vendors.contractRemoved'));
    void dataSource.deleteFile('contracts', path).catch(() => {});
  };

  return (
    <div className="contract row">
      <input ref={input} type="file" accept="application/pdf" hidden
        onChange={(e) => void upload(e.target.files?.[0])} />
      {v.contract_path ? (
        <>
          <button type="button" className="btn small" onClick={() => void open()}><Icon name="notes" size={16} />{t('vendors.openContract')}</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => input.current?.click()}>{busy ? t('vendors.uploading') : t('vendors.replaceContract')}</button>
          <DeleteButton label={t('vendors.removeContract', { name: v.name })} question={t('vendors.removeContractQ')} onConfirm={removeContract} />
        </>
      ) : (
        <button type="button" className="btn small" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={16} />{busy ? t('vendors.uploading') : t('vendors.uploadContract')}</button>
      )}
    </div>
  );
}
