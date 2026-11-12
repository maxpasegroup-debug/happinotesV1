import { translate, type TranslationValues } from './translations';

export function clockTime(seconds: number) {
  const safe =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${String(Math.floor(safe / 60) % 60).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

export function dateOnly(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
}

export function notificationAge(value: string, t: (text: string, values?: TranslationValues) => string = (text, values) => translate('english', text, values)) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return t("{{count}}m ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{{count}}h ago", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t("Yesterday");
  return t("{{count}}d ago", { count: days });
}

export function languageLabel(value: string) {
  if (!value) return "";
  return value[0].toUpperCase() + value.slice(1);
}
