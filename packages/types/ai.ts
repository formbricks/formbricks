import { z } from "zod";

export const AI_PROVIDERS = ["aws", "google", "azure", "openai-compatible"] as const;

export const ZAIProvider = z.enum(AI_PROVIDERS);

export type TAIProvider = z.infer<typeof ZAIProvider>;
