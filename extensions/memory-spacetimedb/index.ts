import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import OpenAI from "openai";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { spacetimedbConfigSchema } from "./config.js";
import { DbConnection } from "./module_bindings/index.js";

type SpacetimeDBConfig = Static<typeof spacetimedbConfigSchema>;

// ============================================================================
// OpenAI Embeddings
// ============================================================================

class Embeddings {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string,
    baseUrl?: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }
}

// ============================================================================
// OpenAI Summarizer
// ============================================================================

class Summarizer {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string,
    baseUrl?: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async extractFacts(
    messages: any[],
  ): Promise<{ text: string; category: string; importance: number }[]> {
    const transcript = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    if (transcript.length < 100) return [];

    const prompt = `Extract important long-term facts, core user preferences, or major decisions from this conversation. 
Return only a JSON object with a 'facts' array. Each object in 'facts' must have 'text', 'category', and 'importance' (0.1 to 1.0) fields.
Categories: preference, decision, entity, fact, other.
If nothing is important enough to remember forever, return an empty array for 'facts'.

Transcript:
${transcript}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "{}";
      const body = JSON.parse(content);
      return body.facts || [];
    } catch (err) {
      return [];
    }
  }
}

// ============================================================================
// Vector Utilities
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Plugin Definition
// ============================================================================

const memoryPlugin = {
  id: "memory-spacetimedb",
  name: "Memory (SpacetimeDB)",
  description: "Ultimate Memory powered by SpacetimeDB 2.0 with real-time sync.",
  kind: "memory" as const,

  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as SpacetimeDBConfig;
    const embeddings = new Embeddings(
      cfg.embedding.apiKey,
      cfg.embedding.model,
      cfg.embedding.baseUrl,
    );

    const summarizerConfig = (cfg.summarizer as any) ?? {};
    const summarizer = new Summarizer(
      summarizerConfig.apiKey || cfg.embedding.apiKey,
      summarizerConfig.model || "phaple/my-combo", // Default to phaple/my-combo given user context
      summarizerConfig.baseUrl || cfg.embedding.baseUrl,
    );

    let conn: DbConnection | null = null;

    api.registerService({
      id: "memory-spacetimedb",
      async start() {
        api.logger.info(`memory-spacetimedb: connecting to ${cfg.host}/${cfg.domain}...`);
        try {
          // Use any for builder to avoid complex generic issues in some TS versions
          const builder = DbConnection.builder() as any;
          conn = builder
            .withUri(cfg.host)
            .withDatabaseName(cfg.domain)
            .withToken(cfg.token)
            .onConnect((_ctx: any, identity: any) => {
              api.logger.info(`memory-spacetimedb: connected as ${identity.toHexString()}`);
            })
            .onConnectError((_ctx: any, error: Error) => {
              api.logger.error(`memory-spacetimedb: connection error: ${error.message}`);
            })
            .build();

          // Subscribe to all tables
          if (conn) {
            (conn.subscriptionBuilder() as any).subscribeToAllTables();
          }
        } catch (err: any) {
          api.logger.error(`memory-spacetimedb: failed to initialize: ${err.message}`);
        }
      },
      async stop() {
        if (conn) {
          conn.disconnect();
          api.logger.info("memory-spacetimedb: disconnected");
        }
      },
    });

    // ========================================================================
    // Tools
    // ========================================================================

    api.registerTool({
      name: "memory_recall",
      label: "Ultimate Recall",
      description: "Search long-term state across all sessions using SpacetimeDB.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ description: "Max results", default: 5 })),
      }),
      async execute(_toolCallId: string, params: unknown) {
        if (!conn) throw new Error("SpacetimeDB not connected");
        const { query, limit = 5 } = params as { query: string; limit?: number };

        const embedding = await embeddings.embed(query);

        // Fetch memories from SpacetimeDB connection's local view
        const allMemories = Array.from((conn.db as any).memories.iter());

        const results = allMemories
          .map((memory: any) => ({
            memory,
            score: cosineSimilarity(embedding, Array.from(memory.embedding)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No relevant memories found in SpacetimeDB." }],
            details: { count: 0, host: cfg.host },
          };
        }

        const text = results
          .map(
            (r: any, i) =>
              `${i + 1}. [${r.memory.category}] ${r.memory.text} (${(r.score * 100).toFixed(1)}%)`,
          )
          .join("\n");

        return {
          content: [
            { type: "text", text: `Found ${results.length} memories in SpacetimeDB:\n\n${text}` },
          ],
          details: { count: results.length, host: cfg.host },
        };
      },
    });

    api.registerTool({
      name: "memory_store",
      label: "Ultimate Store",
      description: "Store a permanent memory in SpacetimeDB with real-time sync.",
      parameters: Type.Object({
        text: Type.String({ description: "Internal thought or fact to remember" }),
        importance: Type.Optional(
          Type.Number({ description: "0-1 importance score", default: 0.7 }),
        ),
        category: Type.Optional(Type.String({ description: "Memory category", default: "other" })),
      }),
      async execute(_toolCallId: string, params: unknown) {
        if (!conn) throw new Error("SpacetimeDB not connected");
        const { text, importance = 0.7, category = "other" } = params as any;

        const embedding = await embeddings.embed(text);
        const id = randomUUID();

        // Call SpacetimeDB reducer via the connection (CamelCased)
        await (conn.reducers as any).storeMemory({
          id,
          text,
          embedding,
          importance,
          category,
        });

        return {
          content: [{ type: "text", text: `Stored in SpacetimeDB: "${text.slice(0, 50)}..."` }],
          details: { action: "stored", id, category },
        };
      },
    });

    // ========================================================================
    // Lifecycle Hooks
    // ========================================================================

    api.on("message_received", async (event, ctx) => {
      if (!conn) return;
      try {
        await (conn.reducers as any).addMessage({
          id: randomUUID(),
          sessionId: ctx.conversationId || "unknown",
          role: "user",
          content: event.content,
        });
      } catch (err) {
        api.logger.warn(`memory-spacetimedb: failed to log user message: ${err}`);
      }
    });

    api.on("message_sent", async (event, ctx) => {
      if (!conn || !event.success) return;
      try {
        await (conn.reducers as any).addMessage({
          id: randomUUID(),
          sessionId: ctx.conversationId || "unknown",
          role: "assistant",
          content: event.content,
        });
      } catch (err) {
        api.logger.warn(`memory-spacetimedb: failed to log assistant message: ${err}`);
      }
    });

    if (cfg.autoRecall) {
      api.on("before_agent_start", async (event: any) => {
        if (!event.prompt || event.prompt.length < 10 || !conn) return;

        try {
          const embedding = await embeddings.embed(event.prompt);
          const allMemories = Array.from((conn.db as any).memories.iter());
          const relevant = allMemories
            .map((m: any) => ({ m, score: cosineSimilarity(embedding, Array.from(m.embedding)) }))
            .filter((r) => r.score > 0.7)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          if (relevant.length > 0) {
            const lines = relevant.map((r, i) => `${i + 1}. [${r.m.category}] ${r.m.text}`);
            const context = `<relevant-memories>\n${lines.join("\n")}\n</relevant-memories>`;
            return { prependContext: context };
          }
        } catch (err) {
          api.logger.warn(`memory-spacetimedb: auto-recall failed: ${err}`);
        }
      });
    }

    if (cfg.autoCapture) {
      api.on("agent_end", async (event: any, ctx: any) => {
        if (!event.success || !conn || !event.messages) return;

        try {
          const facts = await summarizer.extractFacts(event.messages);
          if (facts.length === 0) return;

          for (const fact of facts) {
            const embedding = await embeddings.embed(fact.text);
            const id = randomUUID();

            await (conn.reducers as any).storeMemory({
              id,
              text: fact.text,
              embedding,
              importance: fact.importance || 0.5,
              category: fact.category || "auto-capture",
            });
            api.logger.info(
              `memory-spacetimedb: auto-captured fact ${id}: "${fact.text.slice(0, 30)}..."`,
            );
          }
        } catch (err) {
          api.logger.warn(`memory-spacetimedb: auto-capture failed: ${err}`);
        }
      });
    }
  },
};

export default memoryPlugin;
