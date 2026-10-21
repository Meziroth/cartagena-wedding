// People with access to the planner. Owners invite and remove people; everyone else sees the list.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { qk } from '../data/queries';
import { dataSource, FriendlyError, type InviteResult } from '../data/source';
import { redirectUrl } from '../lib/supabase';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import type { Member, Role } from '../types';

function MemberRow({ m, canRemove }: { m: Member; canRemove: boolean }) {
  const { t } = useTranslation();
  const { me } = useWedding();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => dataSource.removeMember(m.wedding_id, m.user_id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.dataset(m.wedding_id) });
      toast(t('members.removed', { name: m.display_name }));
    },
    onError: () => { setConfirming(false); toast(t('members.removeFailed')); },
  });

  return (
    <li className="member">
      <span className="avatar" aria-hidden="true">{m.display_name.slice(0, 1).toUpperCase()}</span>
      <div className="member-who">
        <b>{m.display_name}{m.user_id === me.user_id && <span className="muted"> {t('members.you')}</span>}</b>
        <span className="muted small">{m.email}</span>
      </div>
      <span className={`pill ${m.role === 'owner' ? 'terra' : 'sage'}`}>{t(`members.role.${m.role}`)}</span>
      {canRemove && !confirming && (
        <button type="button" className="btn small ghost" onClick={() => setConfirming(true)}
          aria-label={t('members.removeLabel', { name: m.display_name })}>{t('members.remove')}</button>
      )}
      {confirming && (
        <div className="member-confirm" role="group" aria-label={t('members.confirmLabel', { name: m.display_name })}>
          <span className="small">{t('members.confirm', { name: m.display_name })}</span>
          <button type="button" className="btn small primary" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {t('members.confirmYes')}
          </button>
          <button type="button" className="btn small" onClick={() => setConfirming(false)}>{t('members.confirmNo')}</button>
        </div>
      )}
    </li>
  );
}

function InviteForm() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const queryClient = useQueryClient();
  const toast = useToast();
  const ids = useId();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('planner');

  const invite = useMutation({
    mutationFn: () => dataSource.inviteMember({ email: email.trim(), displayName: name.trim(), role }, redirectUrl()),
    onSuccess: async (result: InviteResult) => {
      await queryClient.invalidateQueries({ queryKey: qk.dataset(data.wedding.id) });
      toast(t(`members.result.${result}`, { email: email.trim() }));
      if (result !== 'already') { setEmail(''); setName(''); }
    },
  });

  const submit = (e: FormEvent) => { e.preventDefault(); invite.mutate(); };
  const err = invite.error;
  const errId = `${ids}-err`;

  return (
    <form className="invite" onSubmit={submit} aria-describedby={errId}>
      <h3>{t('members.inviteTitle')}</h3>
      <div className="invite-fields">
        <div className="field">
          <label htmlFor={`${ids}-email`}>{t('auth.email')}</label>
          <input id={`${ids}-email`} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-name`}>{t('members.name')}</label>
          <input id={`${ids}-name`} type="text" required maxLength={60} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-role`}>{t('members.roleLabel')}</label>
          <select id={`${ids}-role`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="planner">{t('members.role.planner')}</option>
            <option value="owner">{t('members.role.owner')}</option>
          </select>
        </div>
      </div>
      <p className="muted small">{t(role === 'owner' ? 'members.ownerHint' : 'members.plannerHint')}</p>
      <p id={errId} className="form-error" role="alert">
        {err ? (err instanceof FriendlyError ? err.message : t('members.inviteFailed')) : null}
      </p>
      <div><button type="submit" className="btn primary" disabled={invite.isPending}>
        {invite.isPending ? t('auth.working') : t('members.inviteButton')}
      </button></div>
      <p className="muted small">{t('members.inviteNote')}</p>
    </form>
  );
}

export function Members() {
  const { t } = useTranslation();
  const { data, me, isOwner } = useWedding();
  return (
    <section className="card members" aria-labelledby="membersTitle">
      <h3 id="membersTitle">{t('members.title')}</h3>
      <p className="muted small">{t('members.intro')}</p>
      <ul className="member-list">
        {data.members.map((m) => <MemberRow key={m.user_id} m={m} canRemove={isOwner && m.user_id !== me.user_id} />)}
      </ul>
      {isOwner ? <InviteForm /> : <p className="muted small">{t('members.ownersOnly')}</p>}
    </section>
  );
}
