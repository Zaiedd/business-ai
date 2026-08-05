import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, tFrom, type Locale } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";

export const dictionaries = { en, ar } as const;

export type I18nDict = typeof en;

export function getLocaleFromValue(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleFromRequest(req: NextRequest | Request): Locale {
  const next = req as NextRequest;
  if (typeof next.cookies?.get === "function") {
    return getLocaleFromValue(next.cookies.get(LOCALE_COOKIE)?.value);
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`).exec(cookieHeader);
  return getLocaleFromValue(match ? decodeURIComponent(match[1]) : undefined);
}

export async function getServerLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return getLocaleFromValue(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function getDictionary(locale: Locale): I18nDict {
  return locale === "ar" ? ar : en;
}

/** Server-side t(): resolves dotted paths against the selected locale dictionary. */
export function serverT(locale: Locale) {
  const dict = getDictionary(locale);
  return (path: string, params?: Record<string, string | number>) => tFrom(dict, path, params);
}
