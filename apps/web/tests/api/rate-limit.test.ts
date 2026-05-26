import { describe, it, expect, beforeEach } from "vitest";
import { resetRedisForTests } from "@/lib/api/redis";
import { rateLimit, resetRateLimitForTests } from "@/lib/api/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRedisForTests();
    resetRateLimitForTests();
  });

  it("returns success false on 11th request for 10/min limit", async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const key = `test-${Date.now()}`;

    for (let i = 0; i < 10; i++) {
      const result = await rateLimit(key, { requests: 10, window: 60 });
      expect(result.success).toBe(true);
    }

    const blocked = await rateLimit(key, { requests: 10, window: 60 });
    expect(blocked.success).toBe(false);
    expect(blocked.reset).toBeGreaterThan(Date.now());

    process.env.NODE_ENV = prevEnv;
  });
});
