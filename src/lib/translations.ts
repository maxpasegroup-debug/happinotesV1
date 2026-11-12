import catalog from './i18n/catalog.json';

export type AppLanguage = 'english' | 'malayalam' | 'hindi';
export type TranslationValues = Record<string, string | number>;
export const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  english: 'English', malayalam: 'മലയാളം', hindi: 'हिन्दी',
};
export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'english' || value === 'malayalam' || value === 'hindi';
}
export function translate(language: AppLanguage, text: string, values: TranslationValues = {}) {
  const entry = (catalog as Record<string, string[]>)[text];
  const translated = language === 'english' ? text : entry?.[language === 'malayalam' ? 0 : 1] ?? text;
  return translated.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
}
