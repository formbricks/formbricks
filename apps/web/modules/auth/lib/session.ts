import "server-only";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { authOptions } from "@/modules/auth/lib/authOptions";

/**
 * Request-scoped session read — the single identity choke point for the app (ENG-1054 DAL).
 *
 * Phase 2: a behavior-identical wrapper over `getServerSession(authOptions)`, wrapped in React
 * `cache()` (per-request dedupe) and `server-only`. Centralizing every session read here means the
 * Phase 7 cutover — flipping to Better Auth (`auth.api.getSession`) with a dual-read fallback to
 * aging-out NextAuth cookies — becomes a single change in THIS file, not across the ~40 former
 * `getServerSession` call sites.
 *
 * Returns the same `Session | null` as `getServerSession`, so it is a drop-in replacement.
 */
export const getSession = cache(async () => getServerSession(authOptions));
