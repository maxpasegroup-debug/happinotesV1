import catalog from './i18n/catalog.json';
import international from './i18n/international.json';
import indian from './i18n/indian.json';
import { INDIAN_LANGUAGE_NAMES } from './i18n/indian-languages';
export { INDIAN_LANGUAGE_NAMES, LANGUAGE_SEARCH_ALIASES, RTL_APP_LANGUAGES } from './i18n/indian-languages';

export type AppLanguage = 'english' | keyof typeof INDIAN_LANGUAGE_NAMES | keyof typeof international;
export type TranslationValues = Record<string, string | number>;
export const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  english: 'English', ...INDIAN_LANGUAGE_NAMES,
  spanish: 'Español', french: 'Français', german: 'Deutsch',
  portuguese: 'Português', japanese: '日本語', indonesian: 'Bahasa Indonesia',
};
export const APP_LANGUAGES = Object.keys(APP_LANGUAGE_NAMES) as AppLanguage[];
export function hasAppLanguageTranslations(language: string) {
  return ['english', 'malayalam', 'hindi'].includes(language)
    || Object.prototype.hasOwnProperty.call(international, language)
    || Object.prototype.hasOwnProperty.call(indian, language);
}
export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_LANGUAGE_NAMES, value);
}
export function translate(language: AppLanguage, text: string, values: TranslationValues = {}) {
  const entry = (catalog as Record<string, string[]>)[text];
  const translated = language === 'english' ? text
    : language === 'malayalam' || language === 'hindi' ? entry?.[language === 'malayalam' ? 0 : 1] ?? text
    : (international as Record<string, Record<string, string>>)[language]?.[text]
      ?? (indian as Record<string, Record<string, string>>)[language]?.[text] ?? text;
  return translated.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
}
