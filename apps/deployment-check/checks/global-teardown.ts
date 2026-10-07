import { createApiClient } from "../src/api-client.ts";
import { loadConfig, redact } from "../src/config.ts";
import { readState } from "../src/run-state.ts";
import { CHECK_PREFIX, selectStaleSurveyIds } from "../src/survey.ts";

/**
 * Runs on success and failure. Deletes what this run recorded, then sweeps surveys an earlier, killed run
 * left behind. A cleanup failure is reported but never changes the outcome of the checks themselves.
 */
export default async function globalTeardown(): Promise<void> {
  const config = loadConfig(process.env);
  const api = createApiClient(config);
  const state = readState();
  const workspaceId = state.workspaceId ?? config.workspaceId;
  const problems: string[] = [];

  const remove = async (surveyId: string): Promise<void> => {
    try {
      const response = await api.delete(`/api/v3/surveys/${surveyId}`);
      // 404 means it is already gone, which is the goal.
      if (!response.ok && response.status !== 404) problems.push(`${surveyId}: HTTP ${response.status}`);
    } catch (error) {
      problems.push(`${surveyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await Promise.all(state.surveyIds.map(remove));

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
      await Promise.all(selectStaleSurveyIds(data ?? [], new Date(), state.surveyIds).map(remove));
    } catch (error) {
      problems.push(`sweep: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (problems.length > 0) {
    const text = `\n⚠️  Cleanup incomplete — delete these "${CHECK_PREFIX}" surveys by hand:\n  ${problems.join("\n  ")}\n`;
    process.stdout.write(redact(text, config));
  }
}
