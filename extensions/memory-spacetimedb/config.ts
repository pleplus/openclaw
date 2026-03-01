import { Type } from "@sinclair/typebox";

export const spacetimedbConfigSchema = Type.Object({
    domain: Type.String({ 
        description: "SpacetimeDB Domain or Identity (e.g., 'memory-claw')", 
        default: "memory-claw" 
    }),
    host: Type.String({ 
        description: "SpacetimeDB Host Endpoint", 
        default: "http://localhost:3000" 
    }),
    autoRecall: Type.Boolean({ 
        description: "Automatically inject relevant memories into agent context", 
        default: true 
    }),
    autoCapture: Type.Boolean({ 
        description: "Automatically store important user interactions", 
        default: true 
    }),
});
