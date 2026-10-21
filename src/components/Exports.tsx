// Export buttons, used on Wedding details, the Checklist and the Budget.
import { useTranslation } from 'react-i18next';
import { todayISO } from '../lib/dates';
import { downloadText } from '../lib/download';
import { backupJson, budgetCsv, icsCalendar, todoistCsv } from '../lib/exports';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import { Icon } from './Icon';

export type ExportKind = 'json' | 'budgetCsv' | 'ics' | 'todoist';

const FILES: Record<ExportKind, { name: () => string; type: string }> = {
  json: { name: () => `nick-thuraya-wedding-backup-${todayISO()}.json`, type: 'application/json' },
  budgetCsv: { name: () => 'wedding-budget.csv', type: 'text/csv' },
  ics: { name: () => 'wedding.ics', type: 'text/calendar' },
  todoist: { name: () => 'wedding-checklist-todoist.csv', type: 'text/csv' },
};

export function ExportButton({ kind, label }: { kind: ExportKind; label?: string }) {
  const { t } = useTranslation();
  const { data } = useWedding();
  const toast = useToast();
  const LABEL: Record<ExportKind, string> = { json: 'exports.json', budgetCsv: 'exports.budgetCsv', ics: 'exports.ics', todoist: 'exports.todoist' };

  const run = () => {
    const text = kind === 'json' ? backupJson(data) : kind === 'budgetCsv' ? budgetCsv(data, t) : kind === 'ics' ? icsCalendar(data, t) : todoistCsv(data);
    const name = FILES[kind].name();
    downloadText(name, text, FILES[kind].type);
    toast(t('exports.downloaded', { file: name }));
  };

  return (
    <button type="button" className="btn small" onClick={run}>
      <Icon name={kind === 'ics' ? 'cal' : 'download'} size={16} />{label ?? t(LABEL[kind])}
    </button>
  );
}
