import { type TApiClient, problemDetail } from "./api-client.ts";
import { CheckFailure } from "./diagnostics.ts";
import { recordSurvey } from "./run-state.ts";

/** Creates a survey and records its id first thing, so teardown removes it even if a later step crashes. */
export const createSurvey = async (api: TApiClient, body: object): Promise<string> => {
  const response = await api.post("/api/v3/surveys", body);

  if (response.status === 403) {
    throw new CheckFailure(
      "API key",
      "key cannot create surveys (HTTP 403)",
      "give the key write access to the deployment-check workspace"
    );
  }
  if (response.status !== 201) {
    throw new CheckFailure(
      "Management API",
      `creating a survey returned HTTP ${response.status}: ${problemDetail(response)}`,
      "check the app logs for the request"
    );
  }

  const id = (response.json as { data?: { id?: string } } | undefined)?.data?.id;
  if (!id) {
    throw new CheckFailure(
      "Management API",
      "survey was created but the response carried no id",
      "check the app logs"
    );
  }

  recordSurvey(id);
  return id;
};
