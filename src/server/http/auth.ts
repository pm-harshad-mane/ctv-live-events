import type { NextFunction, Request, Response } from "express";
import type { AppEnv } from "../config/env";
import { createRequestId, sendError } from "../lib/http";

const maskKey = (value: string): string => `${value.slice(0, 3)}***`;

const extractBearer = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }
  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
};

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

const originFromReferer = (refererValue: string | undefined): string | null => {
  if (!refererValue) {
    return null;
  }

  try {
    return new URL(refererValue).origin;
  } catch {
    return null;
  }
};

export const requireApiAccess =
  (env: AppEnv) =>
  (request: Request, response: Response, next: NextFunction): void => {
    const requestId =
      (request.headers["x-request-id"] as string) ?? createRequestId();
    const origin = request.headers.origin;
    const refererOrigin = originFromReferer(
      typeof request.headers.referer === "string"
        ? request.headers.referer
        : undefined
    );

    if (env.publicApiAccess) {
      next();
      return;
    }

    if (
      (origin && env.allowedApiOrigins.includes(origin)) ||
      (refererOrigin && env.allowedApiOrigins.includes(refererOrigin))
    ) {
      next();
      return;
    }

    const bearer = extractBearer(request.headers.authorization);
    const apiKeyHeader = request.headers["x-api-key"];
    const token =
      bearer ?? (typeof apiKeyHeader === "string" ? apiKeyHeader : null);

    if (!token) {
      sendError(
        response,
        requestId,
        401,
        "UNAUTHORIZED",
        "A valid API key is required.",
        false
      );
      return;
    }

    const isAllowed = env.externalApiKeys.some((candidate: string) =>
      safeEqual(candidate, token)
    );
    if (!isAllowed) {
      request.app?.get("logger")?.warn?.(`Rejected API key ${maskKey(token)}`);
      sendError(
        response,
        requestId,
        401,
        "UNAUTHORIZED",
        "A valid API key is required.",
        false
      );
      return;
    }

    next();
  };
