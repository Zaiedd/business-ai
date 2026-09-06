import { describe, expect, it } from "vitest";
import { getLocaleDir, interpolate, isLocale, isRtlLocale, tFrom } from "@/lib/i18n";

describe("i18n Internationalization Helpers", () => {
  it("isLocale validates supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("getLocaleDir and isRtlLocale return direction text", () => {
    expect(getLocaleDir("ar")).toBe("rtl");
    expect(getLocaleDir("en")).toBe("ltr");

    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });

  it("interpolate replaces template variables", () => {
    const template = "Welcome back, {name}! You have {count} messages.";
    const result = interpolate(template, { name: "Sarah", count: 3 });
    expect(result).toBe("Welcome back, Sarah! You have 3 messages.");
  });

  it("tFrom resolves dot-notation keys from dictionary", () => {
    const dict = {
      user: {
        welcome: "Hello, {name}",
      },
    };

    expect(tFrom(dict, "user.welcome", { name: "Ali" })).toBe("Hello, Ali");
    expect(tFrom(dict, "user.nonexistent")).toBe("user.nonexistent");
  });
});
