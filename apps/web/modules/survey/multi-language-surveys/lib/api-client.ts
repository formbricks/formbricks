import type { TLanguageCreateBody, TLanguageUpdateBody } from "@/app/api/internal/languages/schemas";
import type { TLanguageResource, TLanguageSurveyResource } from "@/app/api/internal/languages/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The workspace languages settings page's calls to `/api/internal/languages`. Every failure is a
 * `V3ApiError`; a language the workspace still needs comes back as a 409 whose `detail` the page shows.
 */

const BASE_PATH = "/api/internal/languages";

const languagePath = (languageId: string) => `${BASE_PATH}/${encodeURIComponent(languageId)}`;

export const createLanguage = (workspaceId: string, body: TLanguageCreateBody) =>
  sendApiRequest<TLanguageResource>(buildApiUrl(BASE_PATH, { workspaceId }), { method: "POST", body });

export const updateLanguage = (languageId: string, body: TLanguageUpdateBody) =>
  sendApiRequest<TLanguageResource>(languagePath(languageId), { method: "PATCH", body });

export const deleteLanguage = (languageId: string) =>
  sendApiRequest<void>(languagePath(languageId), { method: "DELETE" });

/** The surveys using a language that the caller may see, for the warning shown before it is removed. */
export const listLanguageSurveys = (languageId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TLanguageSurveyResource[]>(`${languagePath(languageId)}/surveys`, { signal });
