import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/auth";
import {
  bodyLimitForPath,
  checkBodySize,
  getBodyLimitBytes,
  type BodyLimitRoute,
} from "@/lib/api/body-limit";
import { requireAuth } from "@/lib/api/auth-middleware";
import { errorHandler, type RouteHandler } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import {
  getClientIp,
  rateLimit,
  retryAfterSeconds,
} from "@/lib/api/rate-limit";
import { RateLimitError } from "@/lib/api/errors";

export interface RouteOptions {
  auth?: boolean;
  admin?: boolean;
  rateLimit?: { requests: number; window: number } | false;
  bodyLimit?: BodyLimitRoute;
}

async function applyGuards(
  request: NextRequest,
  options: RouteOptions,
): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;

  if (options.admin) {
    const adminError = verifyAdminKey(request);
    if (adminError) return adminError;
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    const route = options.bodyLimit ?? bodyLimitForPath(pathname);
    const sizeError = checkBodySize(request, getBodyLimitBytes(route));
    if (sizeError) throw sizeError;
  }

  if (options.rateLimit !== false) {
    const limits = options.rateLimit ?? { requests: 60, window: 60 };
    const ip = getClientIp(request);
    let key = `${pathname}:${ip}`;

    if (options.auth) {
      const authHeader = request.headers.get("authorization");
      if (authHeader) {
        key = `${pathname}:${authHeader.slice(0, 32)}`;
      }
    }

    const result = await rateLimit(key, limits);
    if (!result.success) {
      throw new RateLimitError(retryAfterSeconds(result.reset));
    }
  }

  if (options.auth) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
  }

  return null;
}

export function withRoute(
  options: RouteOptions,
  handler: RouteHandler,
): RouteHandler {
  const guarded: RouteHandler = async (request, context) => {
    const guardResponse = await applyGuards(request, options);
    if (guardResponse) return attachRequestId(guardResponse, request);
    return handler(request, context);
  };

  return errorHandler(guarded);
}

export function attachRequestId(response: NextResponse, request: NextRequest): NextResponse {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", getRequestId(request));
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
