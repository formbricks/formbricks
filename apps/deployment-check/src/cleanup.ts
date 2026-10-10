import { type TApiClient } from "./api-client.ts";
import { CHECK_PREFIX, selectStaleSurveyIds } from "./survey.ts";

interface TCleanupInput {
  api: TApiClient;
  surveyIds: readonly string[];
  workspaceId: string | undefined;
  now: Date;
}

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Deletes the surveys this run recorded, then sweeps `[deployment-check]` surveys an earlier, killed run left
 * behind. Never throws: a cleanup failure is returned as a list of problems so it cannot mask the checks'
 * own outcome. Only prefixed surveys are ever touched.
 */
export const cleanup = async ({ api, surveyIds, workspaceId, now }: TCleanupInput): Promise<string[]> => {
  const problems: string[] = [];

  const remove = async (surveyId: string): Promise<void> => {
    try {
      const response = await api.delete(`/api/v3/surveys/${surveyId}`);
      // 404 means it is already gone, which is the goal.
      if (!response.ok && response.status !== 404) problems.push(`${surveyId}: HTTP ${response.status}`);
    } catch (error) {
      problems.push(`${surveyId}: ${describe(error)}`);
    }
  };

  await Promise.all(surveyIds.map(remove));

  if (workspaceId) {
    try {
      const query = new URLSearchParams({
        workspaceId,
        limit: "250",
        "filter[name][contains]": CHECK_PREFIX,
      });
      const listed = await api.get(`/api/v3/surveys?${query.toString()}`);
      const data = (listed.json as { data?: { id: string; name: string; createdAt: string }[] } | undefined)
        ?.data;
      await Promise.all(selectStaleSurveyIds(data ?? [], now, surveyIds).map(remove));
    } catch (error) {
      problems.push(`sweep: ${describe(error)}`);
    }
  }

  return problems;
};
