import type { TActionClass, TActionClassInput } from "@formbricks/types/action-classes";
import type { TActionClassSurveysResource } from "@/app/api/internal/action-classes/schemas";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Client fetchers for the app connection settings and the app shell. Each throws a `V3ApiError` on a refusal. */

const actionClassPath = (actionClassId: string) =>
  `/api/internal/action-classes/${encodeURIComponent(actionClassId)}`;

type TActionClassJson = Omit<TActionClass, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Change an action. Answers with the action as stored, timestamps revived to `Date`s: the survey editor
 * puts it back into the survey's triggers, which are saved with the survey.
 */
export const updateActionClass = async (
  actionClassId: string,
  body: TActionClassInput
): Promise<TActionClass> => {
  const updated = await sendApiRequest<TActionClassJson>(actionClassPath(actionClassId), {
    method: "PATCH",
    body,
  });
  return { ...updated, createdAt: new Date(updated.createdAt), updatedAt: new Date(updated.updatedAt) };
};

export const deleteActionClass = (actionClassId: string) =>
  sendApiRequest<void>(actionClassPath(actionClassId), { method: "DELETE" });

/** The surveys an action triggers, by name, leaving out the one being edited. */
export const getActionClassSurveys = (actionClassId: string, excludeSurveyId?: string) =>
  getApiData<TActionClassSurveysResource>(
    buildApiUrl(`${actionClassPath(actionClassId)}/surveys`, { excludeSurveyId })
  );

/** The latest stable Formbricks release tag, or null when it couldn't be found out. */
export const getLatestRelease = async ({ signal }: { signal?: AbortSignal } = {}): Promise<string | null> =>
  (await getApiData<{ tag: string | null }>("/api/internal/releases/latest", { signal })).tag;
