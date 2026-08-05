export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "bsai_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function getLocaleDir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "ar";
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

export function tFrom(dict: unknown, path: string, params?: Record<string, string | number>): string {
  let current: unknown = dict;
  for (const part of path.split(".")) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? interpolate(current, params) : path;
}

export function setLocaleCookie(
  response: { cookies: { set: (name: string, value: string, opts: object) => void } },
  locale: Locale,
) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
