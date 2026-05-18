import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

describe("marketing routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders landing content on /landing", async () => {
    const { default: MarketingLandingPage } = await import("../../src/app/landing/page");
    const html = renderToStaticMarkup(React.createElement(MarketingLandingPage));

    expect(html).toContain("Precision Vesting");
    expect(html).toContain("Join waitlist");
    expect(html).toContain("Questions, answered.");
  });

  it("rewrites root route to /landing", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/",
          destination: "/landing",
        }),
      ]),
    );
  });
});
