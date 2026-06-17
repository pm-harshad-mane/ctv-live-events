import type { Response } from "express";
import type { ApiEnvelope, ErrorEnvelope } from "../../shared/types/api";

export const createRequestId = (): string =>
  `req_${Math.random().toString(36).slice(2, 10)}`;

export const sendEnvelope = <T>(
  response: Response,
  requestId: string,
  data: T,
  warnings: string[] = [],
  status = 200
): void => {
  const envelope: ApiEnvelope<T> = {
    api_version: "v1",
    request_id: requestId,
    generated_at: new Date().toISOString(),
    data,
    warnings
  };
  response.status(status).json(envelope);
};

export const sendError = (
  response: Response,
  requestId: string,
  status: number,
  code: ErrorEnvelope["error"]["code"],
  message: string,
  retryable = false,
  headers?: Record<string, string>
): void => {
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }
  }
  const envelope: ErrorEnvelope = {
    error: {
      code,
      message,
      retryable
    },
    request_id: requestId,
    timestamp: new Date().toISOString()
  };
  response.status(status).json(envelope);
};
