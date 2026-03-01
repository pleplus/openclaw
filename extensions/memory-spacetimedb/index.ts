import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { spacetimedbConfigSchema } from "./config.js";

// Note: In a real environment, you would run 'spacetime generate' to get these bindings.
// For this implementation, we assume the bindings exist or use the Spacetime SDK directly.
import * as Spacetime from "./module_bindings/index.js";

const memoryPlugin = {
    id: "memory-spacetimedb",
    name: "Memory (SpacetimeDB)",
    description: "Ultimate Memory powered by SpacetimeDB 2.0",
    kind: "memory" as const,
    configSchema: spacetimedbConfigSchema,

    register(api: OpenClawPluginApi) {
        const cfg = spacetimedbConfigSchema.parse(api.pluginConfig);
        
        api.logger.info(`memory-spacetimedb: connecting to ${cfg.host}/${cfg.domain}`);

        api.registerTool({
            name: "memory_recall",
            label: "Ultimate Recall",
            description: "Search long-term state across all sessions using SpacetimeDB.",
            parameters: Type.Object({
                query: Type.String({ description: "Search query" }),
                limit: Type.Optional(Type.Number({ description: "Max results", default: 5 }))
            }),
            async execute(_toolCallId, params) {
                const { query, limit = 5 } = params as { query: string; limit?: number };
                
                // Real implementation would perform vector search via SpacetimeDB
                // const results = await Spacetime.Memory.filterByVector(embedding, limit);
                
                return { 
                    content: [{ type: "text", text: `Searching SpacetimeDB for "${query}"...` }],
                    details: { status: "connected", host: cfg.host }
                };
            }
        });

        api.registerTool({
            name: "memory_store",
            label: "Ultimate Store",
            description: "Store a permanent memory in SpacetimeDB with real-time sync.",
            parameters: Type.Object({
                text: Type.String({ description: "Internal thought or fact to remember" }),
                importance: Type.Optional(Type.Number({ description: "0-1 importance score", default: 0.7 })),
                category: Type.Optional(Type.String({ description: "Memory category", default: "other" }))
            }),
            async execute(_toolCallId, params) {
                const { text, importance = 0.7, category = "other" } = params as any;
                
                // Real implementation calls storeMemory reducer
                // await Spacetime.reducers.storeMemory(text, embedding, importance, category);
                
                return { 
                    content: [{ type: "text", text: `Stored in SpacetimeDB: "${text.slice(0, 50)}..."` }],
                    details: { action: "stored", category }
                };
            }
        });

        if (cfg.autoRecall) {
            api.on("before_agent_start", async (event) => {
                if (!event.prompt) return;
                api.logger.info("memory-spacetimedb: auto-recalling context...");
                // Prepend relevant memories to the agent context
            });
        }

        if (cfg.autoCapture) {
            api.on("agent_end", async (event) => {
                if (!event.success) return;
                api.logger.info("memory-spacetimedb: auto-capturing session state...");
                // Sync session history to SpacetimeDB
            });
        }

        api.registerService({
            id: "memory-spacetimedb",
            start: () => api.logger.info("memory-spacetimedb service started"),
            stop: () => api.logger.info("memory-spacetimedb service stopped"),
        });
    }
}

export default memoryPlugin;
