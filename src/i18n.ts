// Every user-facing string lives in src/locales. Spanish is wired up but empty, so it falls back to English.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'nt-lang';

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return (LANGS as readonly string[]).includes(v ?? '') ? (v as Lang) : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang: Lang): void {
  try { localStorage.setItem(KEY, lang); } catch { /* private mode: keep it for this session only */ }
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: storedLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
