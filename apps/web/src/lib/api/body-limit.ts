import type { NextRequest } from "next/server";
import { PayloadTooLargeError } from "@/lib/api/errors";

export type BodyLimitRoute =
  | "campaigns"
  | "import"
  | "root-versions"
  | "default";

const LIMITS: Record<BodyLimitRoute, number> = {
  campaigns: 2 * 1024 * 1024,
  import: 10 * 1024 * 1024,
  "root-versions": 2 * 1024 * 1024,
  default: 1 * 1024 * 1024,
};

export function getBodyLimitBytes(route: BodyLimitRoute): number {
  return LIMITS[route];
}

export function checkBodySize(
  request: NextRequest,
  maxBytes: number,
): PayloadTooLargeError | null {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    if (
      process.env.NODE_ENV === "production" &&
      (request.method === "POST" || request.method === "PUT" || request.method === "PATCH")
    ) {
      return new PayloadTooLargeError("Content-Length header is required");
    }
    return null;
  }

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size <= maxBytes) return null;

  return new PayloadTooLargeError(
    `Request body exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`,
  );
}

export function bodyLimitForPath(pathname: string): BodyLimitRoute {
  if (pathname.endsWith("/import")) return "import";
  if (pathname.endsWith("/root-versions")) return "root-versions";
  if (pathname === "/api/campaigns") return "campaigns";
  return "default";
}
