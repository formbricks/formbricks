import "server-only";
import { env } from "@/lib/env";

/** Resolve the operation's budget once, before any deadline or retry budget is calculated. */
export const getAITimeoutMs = (baseMs: number): number => Math.ceil(baseMs * env.AI_TIMEOUT_MULTIPLIER);
