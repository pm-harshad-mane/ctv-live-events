import type { NextFunction, Request, Response } from "express";
import type { AppEnv } from "../config/env";

export const withCors =
  (env: AppEnv) =>
  (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.headers.origin;

    if (origin && env.allowedApiOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, X-API-Key, X-Request-Id"
      );
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
  };
