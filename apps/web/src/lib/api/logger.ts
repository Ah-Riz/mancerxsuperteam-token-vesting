import pino from "pino";

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }),
});

export interface RequestLogFields {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  level?: "info" | "warn" | "error";
  message?: string;
  code?: string;
  stack?: string;
}

export function logRequest(fields: RequestLogFields): void {
  const {
    level = fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info",
    ...rest
  } = fields;

  const payload = {
    timestamp: new Date().toISOString(),
    ...rest,
  };

  if (level === "error") {
    logger.error(payload);
  } else if (level === "warn") {
    logger.warn(payload);
  } else {
    logger.info(payload);
  }
}
