import { describe, it, expect, afterEach } from "vitest";
import { getPoolOptions } from "@/lib/db";

describe("database pool configuration", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.VERCEL = prevVercel;
  });

  it("uses max 10 connections in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;

    const options = getPoolOptions(
      "postgresql://ci:ci@127.0.0.1:5432/ci?sslmode=disable",
    );
    expect(options.max).toBe(10);
    expect(options.keepalive).toBe(30);
    expect(options.connect_timeout).toBe(10);
  });

  it("uses smaller pool in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;

    const options = getPoolOptions(
      "postgresql://ci:ci@127.0.0.1:5432/ci?sslmode=disable",
    );
    expect(options.max).toBe(3);
    expect(options.keepalive).toBe(0);
  });
});
