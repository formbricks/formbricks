import { z } from "zod";

/**
 * The enrichment-status read is addressed by workspace alone: the directories it covers are resolved
 * server-side from that workspace, so the Hub `tenant_id` is never taken from the caller.
 */
export const ZEnrichmentStatusQuery = z.object({ workspaceId: z.cuid2() }).strict();

export type TEnrichmentStatusQuery = z.infer<typeof ZEnrichmentStatusQuery>;
