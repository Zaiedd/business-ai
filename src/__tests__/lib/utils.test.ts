import { describe, expect, it } from "vitest";
import {
  addDays,
  clamp,
  cn,
  dayKey,
  endOfDay,
  formatCurrency,
  formatDelta,
  formatNumber,
  formatPercent,
  round2,
  safeParseFloat,
  safeParseInt,
  startOfDay,
  stripBidi,
} from "@/lib/utils";

describe("Utils Library", () => {
  it("cn merges class names properly", () => {
    expect(cn("btn", false && "hidden", "btn-primary")).toBe("btn btn-primary");
    expect(cn("px-2", null, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("clamp limits numbers within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("addDays modifies date accurately", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const next = addDays(start, 5);
    expect(next.getDate()).toBe(6);
  });

  it("startOfDay and endOfDay compute bounds", () => {
    const d = new Date(2026, 7, 10, 14, 30, 0);
    const start = startOfDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    const end = endOfDay(d);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("dayKey formats ISO date string YYYY-MM-DD", () => {
    const d = new Date(2026, 7, 9); // Month is 0-indexed (7 = Aug)
    expect(dayKey(d)).toBe("2026-08-09");
  });

  it("stripBidi removes invisible bidi control characters", () => {
    const input = "\u200e$100.00\u200f";
    expect(stripBidi(input)).toBe("$100.00");
  });

  it("formatCurrency formats USD correctly", () => {
    const val = formatCurrency(1250.5, "USD", false, "en");
    expect(val).toContain("1,250.50");
  });

  it("formatNumber formats number with locale digits", () => {
    expect(formatNumber(1000.456, 2, "en")).toBe("1,000.46");
  });

  it("formatPercent formats decimals as percentage string", () => {
    expect(formatPercent(0.1234, 1)).toBe("12.3%");
  });

  it("formatDelta adds sign for positive values", () => {
    expect(formatDelta(15.2)).toBe("+15.2%");
    expect(formatDelta(-4.5)).toBe("-4.5%");
  });

  it("safeParseFloat handles invalid types gracefully", () => {
    expect(safeParseFloat(42.5)).toBe(42.5);
    expect(safeParseFloat("19.99")).toBe(19.99);
    expect(safeParseFloat("invalid")).toBe(0);
    expect(safeParseFloat(null)).toBe(0);
  });

  it("safeParseInt parses integers accurately", () => {
    expect(safeParseInt(42)).toBe(42);
    expect(safeParseInt("100")).toBe(100);
    expect(safeParseInt("abc")).toBe(0);
  });

  it("round2 rounds numbers to 2 decimal places", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10.121)).toBe(10.12);
  });
});
