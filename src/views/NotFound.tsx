// Shown for an address that doesn't match any screen.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <>
      <div className="sec-head"><div><h2>{t('notFound.title')}</h2><p className="muted">{t('notFound.body')}</p></div></div>
      <p><Link className="btn primary" to="/">{t('notFound.home')}</Link></p>
    </>
  );
}
