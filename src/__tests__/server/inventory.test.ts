import { describe, expect, it } from "vitest";
import { stockStatus } from "@/server/inventory";

describe("Inventory Business Logic", () => {
  it("stockStatus evaluates OUT when quantity is 0 or less", () => {
    expect(stockStatus({ stockQty: 0, lowStockThreshold: 10 })).toBe("OUT");
    expect(stockStatus({ stockQty: -2, lowStockThreshold: 10 })).toBe("OUT");
  });

  it("stockStatus evaluates LOW when quantity is under or equal to threshold", () => {
    expect(stockStatus({ stockQty: 5, lowStockThreshold: 10 })).toBe("LOW");
    expect(stockStatus({ stockQty: 10, lowStockThreshold: 10 })).toBe("LOW");
  });

  it("stockStatus evaluates OK when quantity exceeds low stock threshold", () => {
    expect(stockStatus({ stockQty: 15, lowStockThreshold: 10 })).toBe("OK");
    expect(stockStatus({ stockQty: 100, lowStockThreshold: 5 })).toBe("OK");
  });
});
