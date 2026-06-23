import type { StructuredSchemaDefinition } from "./schemas";
import type { RequestOrigin } from "../../shared/schemas/live";

export type StructuredResponseRequest = {
  instructions: string;
  input: string;
  schema: StructuredSchemaDefinition;
  requestOrigin?: RequestOrigin;
  maxOutputTokens?: number;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "none";
  include?: string[];
};

export interface StructuredResponseTransport {
  createStructuredResponse(
    request: StructuredResponseRequest
  ): Promise<unknown>;
}
