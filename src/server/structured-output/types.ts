import type { StructuredSchemaDefinition } from "./schemas";

export type StructuredResponseRequest = {
  instructions: string;
  input: string;
  schema: StructuredSchemaDefinition;
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
