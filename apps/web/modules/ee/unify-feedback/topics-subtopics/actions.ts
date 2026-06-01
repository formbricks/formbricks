"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { semanticSearchFeedbackRecords } from "@/modules/hub/service";
import type { SemanticSearchResultItem } from "@/modules/hub/types";

const TOPICS_PREVIEW_PAGE_SIZE = 50;
const SEARCH_CONCURRENCY = 4;

const ZSemanticSearchFeedbackRecordsAction = z.object({
  workspaceId: ZId,
  query: z.string().trim().min(1).max(500),
  minScore: z.number().min(0).max(1).optional(),
  cursors: z.record(z.string(), z.string()).optional(),
});

export type TTopicsPreviewSearchResult = SemanticSearchResultItem & {
  tenant_id: string;
  directory_name: string;
};

export type TTopicsPreviewSearchActionResult = {
  results: TTopicsPreviewSearchResult[];
  cursors: Record<string, string>;
  unavailable: boolean;
  unavailableMessage?: string;
};

const ensureReadAccess = async (userId: string, workspaceId: string): Promise<void> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isFeedbackDirectoriesAllowed) {
    throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
  }
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "workspaceTeam",
        minPermission: "read",
        workspaceId,
      },
    ],
  });
};

export const semanticSearchFeedbackRecordsAction = authenticatedActionClient
  .inputSchema(ZSemanticSearchFeedbackRecordsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZSemanticSearchFeedbackRecordsAction>;
    }): Promise<TTopicsPreviewSearchActionResult> => {
      await ensureReadAccess(ctx.user.id, parsedInput.workspaceId);

      const directories = await getFeedbackDirectoriesByWorkspaceId(parsedInput.workspaceId);
      if (directories.length === 0) {
        return { results: [], cursors: {}, unavailable: false };
      }

      // On "load more" only re-query directories that returned a cursor on the previous page.
      // Filtering against the workspace's directories above also guards against cursor-bag
      // tampering — any directory id not in this set is silently dropped.
      const targetDirectories = parsedInput.cursors
        ? directories.filter((d) => Boolean(parsedInput.cursors?.[d.id]))
        : directories;

      const searches: {
        directory: (typeof directories)[number];
        result: Awaited<ReturnType<typeof semanticSearchFeedbackRecords>>;
      }[] = [];
      for (let i = 0; i < targetDirectories.length; i += SEARCH_CONCURRENCY) {
        const chunk = targetDirectories.slice(i, i + SEARCH_CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(async (directory) => {
            const cursor = parsedInput.cursors?.[directory.id];
            const result = await semanticSearchFeedbackRecords({
              tenant_id: directory.id,
              query: parsedInput.query,
              limit: TOPICS_PREVIEW_PAGE_SIZE,
              min_score: parsedInput.minScore,
              ...(cursor ? { cursor } : {}),
            });
            return { directory, result };
          })
        );
        searches.push(...chunkResults);
      }

      const successfulResults = searches.flatMap(({ directory, result }) =>
        (result.data?.data ?? []).map((item) => ({
          ...item,
          tenant_id: directory.id,
          directory_name: directory.name,
        }))
      );

      const nextCursors: Record<string, string> = {};
      for (const { directory, result } of searches) {
        const nextCursor = result.data?.next_cursor;
        if (nextCursor) {
          nextCursors[directory.id] = nextCursor;
        }
      }

      if (successfulResults.length > 0) {
        return {
          results: successfulResults.toSorted((a, b) => b.score - a.score),
          cursors: nextCursors,
          unavailable: false,
        };
      }

      const firstError = searches.find(({ result }) => result.error)?.result.error;
      if (firstError?.status === 0 || firstError?.status === 503) {
        return {
          results: [],
          cursors: {},
          unavailable: true,
          unavailableMessage: firstError.message,
        };
      }

      if (firstError) {
        throw new Error(firstError.message);
      }

      return { results: [], cursors: {}, unavailable: false };
    }
  );
