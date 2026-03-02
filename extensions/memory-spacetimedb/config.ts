import { Type } from "@sinclair/typebox";

export const MEMORY_CATEGORIES = ["preference", "decision", "entity", "fact", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const spacetimedbConfigSchema = Type.Object({
  domain: Type.String({
    description: "SpacetimeDB Domain or Identity (e.g., 'memory-claw-phaple')",
    default: "memory-claw-phaple",
  }),
  host: Type.String({
    description: "SpacetimeDB Host Endpoint",
    default: "https://maincloud.spacetimedb.com",
  }),
  token: Type.Optional(
    Type.String({
      description: "SpacetimeDB Auth Token (optional, will use anonymous if empty)",
    }),
  ),
  autoRecall: Type.Boolean({
    description: "Automatically inject relevant memories into agent context",
    default: true,
  }),
  autoCapture: Type.Boolean({
    description: "Automatically store important user interactions",
    default: true,
  }),
  embedding: Type.Object({
    model: Type.String({ default: "text-embedding-3-small" }),
    apiKey: Type.String({ description: "OpenAI API Key for embeddings" }),
    baseUrl: Type.Optional(Type.String()),
  }),
  summarizer: Type.Optional(
    Type.Object({
      model: Type.String({ default: "gpt-4o-mini" }),
      apiKey: Type.Optional(Type.String()),
      baseUrl: Type.Optional(Type.String()),
    }),
  ),
});
