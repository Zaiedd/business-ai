"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getLocaleDir, tFrom, type Locale } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";

const dictionaries = { en, ar } as const;

type TFunction = (path: string, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: TFunction;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, locale: initial }: { children: React.ReactNode; locale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? DEFAULT_LOCALE);

  const applyLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      const root = document.documentElement;
      root.lang = next;
      root.dir = getLocaleDir(next);
    } catch {
      // ignore in non-browser contexts
    }
    fetch("/api/i18n", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
  }, []);

  const t = useCallback<TFunction>(
    (path, params) => tFrom(dictionaries[locale], path, params),
    [locale],
  );

  const setLocale = useCallback((next: Locale) => applyLocale(next), [applyLocale]);
  const toggleLocale = useCallback(() => applyLocale(locale === "en" ? "ar" : "en"), [applyLocale, locale]);

  const value: I18nContextValue = {
    locale,
    dir: getLocaleDir(locale),
    t,
    setLocale,
    toggleLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
