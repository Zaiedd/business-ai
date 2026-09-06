import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("Sliding Window Rate Limiter", () => {
  it("allows requests under the limit", () => {
    const key = "test_key_1";
    const res1 = rateLimit(key, 3, 60000);
    const res2 = rateLimit(key, 3, 60000);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
  });

  it("blocks requests that exceed maximum allowed hits", () => {
    const key = "test_key_blocked";

    rateLimit(key, 2, 60000);
    rateLimit(key, 2, 60000);

    // 3rd hit should fail
    const blocked = rateLimit(key, 2, 60000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
});
