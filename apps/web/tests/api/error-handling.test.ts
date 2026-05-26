import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCampaignByAddress } from "@/app/api/campaigns/[treeAddress]/route";
import { errorHandler } from "@/lib/api/errors";
import { ValidationError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/json-response";
import { makeUrl } from "../helpers/requests";

describe("structured error handling", () => {
  it("returns NOT_FOUND with requestId for missing campaign", async () => {
    const req = new NextRequest(makeUrl("/api/campaigns/missing"));
    const res = await getCampaignByAddress(req, {
      params: Promise.resolve({ treeAddress: "missing" }),
    });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe("NOT_FOUND");
    expect(json.requestId).toBeTruthy();
    expect(json.error).toContain("not found");
  });

  it("errorHandler returns generic 500 with requestId", async () => {
    const handler = errorHandler(async () => {
      throw new Error("secret db password leaked");
    });

    const req = new NextRequest(makeUrl("/api/test"));
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(json.requestId).toBeTruthy();
    expect(json.error).not.toContain("password");
  });

  it("errorHandler maps ValidationError to 400 with details", async () => {
    const handler = errorHandler(async () => {
      throw new ValidationError("Validation failed", [{ path: ["x"] }]);
    });

    const res = await handler(new NextRequest(makeUrl("/api/test")));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.details).toBeDefined();
  });

  it("jsonResponse converts bigint to strings", async () => {
    const res = jsonResponse({ amount: 1000n, nested: { slot: 42n } });
    const text = await res.text();
    const parsed = JSON.parse(text);
    expect(parsed.amount).toBe("1000");
    expect(parsed.nested.slot).toBe("42");
  });

  it("jsonResponse never throws on bigint values", async () => {
    const res = jsonResponse({ slot: 999999999999n });
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text).slot).toBe("999999999999");
  });
});
