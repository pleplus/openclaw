import { ReducerContext, Table, SpacetimeType, Primary, Vector, Reducer } from "@clockworklabs/spacetimedb-sdk";

/**
 * SpacetimeDB Module for OpenClaw "Ultimate Memory"
 */

@SpacetimeType
export type MemoryCategory = "preference" | "decision" | "fact" | "entity" | "other";

@Table("public")
export class Session {
    @Primary
    id: string;
    updatedAt: number;
    metadataJson: string; // Serialized SessionEntry metadata
}

@Table("public")
export class Message {
    @Primary
    id: string;
    sessionId: string;
    role: string;
    content: string;
    timestamp: number;
}

@Table("public")
export class Memory {
    @Primary
    id: string;
    text: string;
    @Vector(1536) // Default OpenAI embedding size
    embedding: number[];
    importance: number;
    category: MemoryCategory;
    createdAt: number;
}

@Reducer
export function addMessage(ctx: ReducerContext, sessionId: string, role: string, content: string) {
    const id = ctx.sender.toString() + "_" + Date.now();
    Message.insert({ id, sessionId, role, content, timestamp: Date.now() });
    
    // Update session timestamp
    const session = Session.findById(sessionId);
    if (session) {
        session.updatedAt = Date.now();
        Session.update(session);
    } else {
        Session.insert({ id: sessionId, updatedAt: Date.now(), metadataJson: "{}" });
    }
}

@Reducer
export function storeMemory(ctx: ReducerContext, text: string, embedding: number[], importance: number, category: MemoryCategory) {
    const id = ctx.sender.toString() + "_" + Date.now();
    Memory.insert({ id, text, embedding, importance, category, createdAt: Date.now() });
}

@Reducer
export function deleteMemory(ctx: ReducerContext, id: string) {
    Memory.deleteById(id);
}
