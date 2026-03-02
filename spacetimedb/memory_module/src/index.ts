import { schema, table, t, type ReducerCtx, type InferSchema } from "spacetimedb/server";

const spacetimedb = schema({
  sessions: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      updatedAt: t.u64(),
      metadataJson: t.string(),
    },
  ),
  messages: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      sessionId: t.string(),
      role: t.string(),
      content: t.string(),
      timestamp: t.u64(),
    },
  ),
  memories: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      text: t.string(),
      embedding: t.array(t.f32()),
      importance: t.f32(),
      category: t.string(),
      createdAt: t.u64(),
    },
  ),
});

export type S = InferSchema<typeof spacetimedb>;

export const add_message = spacetimedb.reducer(
  {
    id: t.string(),
    sessionId: t.string(),
    role: t.string(),
    content: t.string(),
  },
  (
    ctx: ReducerCtx<S>,
    {
      id,
      sessionId,
      role,
      content,
    }: { id: string; sessionId: string; role: string; content: string },
  ) => {
    ctx.db.messages.insert({
      id,
      sessionId,
      role,
      content,
      timestamp: BigInt(Date.now()),
    });

    const session = ctx.db.sessions.id.find(sessionId);
    if (session) {
      ctx.db.sessions.id.update({
        ...session,
        updatedAt: BigInt(Date.now()),
      });
    } else {
      ctx.db.sessions.insert({
        id: sessionId,
        updatedAt: BigInt(Date.now()),
        metadataJson: "{}",
      });
    }
  },
);

export const store_memory = spacetimedb.reducer(
  {
    id: t.string(),
    text: t.string(),
    embedding: t.array(t.f32()),
    importance: t.f32(),
    category: t.string(),
  },
  (
    ctx: ReducerCtx<S>,
    {
      id,
      text,
      embedding,
      importance,
      category,
    }: { id: string; text: string; embedding: number[]; importance: number; category: string },
  ) => {
    ctx.db.memories.insert({
      id,
      text,
      embedding,
      importance,
      category,
      createdAt: BigInt(Date.now()),
    });
  },
);

export const delete_memory = spacetimedb.reducer(
  {
    id: t.string(),
  },
  (ctx: ReducerCtx<S>, { id }: { id: string }) => {
    ctx.db.memories.id.delete(id);
  },
);

export default spacetimedb;
