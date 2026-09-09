import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { type TAIDataProfile, buildDataProfileQueries, collectDataProfile } from "./ai-data-profile";

/**
 * Sources, questions and languages are directory configuration rather than feedback: they change
 * when someone adds a survey, not when someone answers one. Five minutes keeps a newly-added source
 * reachable within one coffee break while a burst of generations costs one set of cube queries.
 */
const AI_DATA_PROFILE_TTL_MS = 5 * 60 * 1000;

const CUBE_QUERY_SOURCE = "charts.aiDataProfile" as const;

type TGetAIDataProfileInput = {
  feedbackDirectoryId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
};

/**
 * Profile the directory the generation will run against, for the system prompt.
 *
 * Deliberately non-fatal: a chart generated from the schema alone is the behaviour this replaces, so
 * a cube hiccup here degrades generation quality rather than failing the request. The caller appends
 * `formatDataProfile(null)`, which is empty.
 */
export const getAIDataProfile = async ({
  feedbackDirectoryId,
  workspaceId,
  organizationId,
  userId,
}: TGetAIDataProfileInput): Promise<TAIDataProfile | null> => {
  const queries = buildDataProfileQueries();
  const runQuery = (query: (typeof queries)[keyof typeof queries]) =>
    executeTenantScopedQuery({
      query,
      feedbackDirectoryId,
      workspaceId,
      organizationId,
      userId,
      source: CUBE_QUERY_SOURCE,
    });

  try {
    return await cache.withCache(
      async () => {
        const [sources, questions, languages, timeline] = await Promise.all([
          runQuery(queries.sources),
          runQuery(queries.questions),
          runQuery(queries.languages),
          runQuery(queries.timeline),
        ]);

        return collectDataProfile({ sources, questions, languages, timeline });
      },
      // Keyed on the directory alone: the profile is the directory's contents, and every caller has
      // already passed the same read check to get here.
      createCacheKey.custom("analytics", feedbackDirectoryId, "ai-data-profile"),
      AI_DATA_PROFILE_TTL_MS
    );
  } catch (error) {
    logger.warn(
      { err: error, feedbackDirectoryId, workspaceId, organizationId },
      "Failed to profile feedback directory for AI chart generation; falling back to schema-only context"
    );
    return null;
  }
};
