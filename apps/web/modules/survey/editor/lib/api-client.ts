import type { ActionClass, Language } from "@formbricks/database/prisma-browser";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TActionClassCreateBody } from "@/app/api/internal/action-classes/schemas";
import type { TLanguageResource } from "@/app/api/internal/languages/serializers";
import type { TUnsplashPhotoResource } from "@/app/api/internal/unsplash-photos/serializers";
import type { TEditorWorkspaceResource } from "@/app/api/internal/workspaces/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { type TJsonTimestamps, reviveTimestamps } from "@/modules/api/lib/json-timestamps";
import { reviveSurveyDates } from "@/modules/survey/editor/lib/survey-json";
import type { TEditorWorkspace } from "@/modules/survey/editor/lib/workspace";
import type { TSurveyDraft } from "@/modules/survey/editor/types/survey";

/**
 * The survey editor's calls to `/api/internal/*`. Each throws a `V3ApiError` on a refusal. Timestamps come
 * back as ISO strings and are revived to `Date`s here, so the editor's state keeps the types the page
 * rendered it with.
 */

/**
 * Create an action in the workspace, from the trigger picker. The workspace travels in the query, so the
 * form's own copy of it is dropped from the body, which refuses unknown keys.
 */
export const createActionClass = async (
  workspaceId: string,
  { workspaceId: _workspaceId, ...body }: TActionClassCreateBody & { workspaceId?: string }
): Promise<ActionClass> =>
  reviveTimestamps(
    await sendApiRequest<TJsonTimestamps<ActionClass>>(
      buildApiUrl("/api/internal/action-classes", { workspaceId }),
      { method: "POST", body }
    )
  );

/** One page of Unsplash photos for the background picker. */
export const searchUnsplashPhotos = (
  query: string,
  page: number,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TUnsplashPhotoResource[]> =>
  getApiData<TUnsplashPhotoResource[]>(buildApiUrl("/api/internal/unsplash-photos", { query, page }), {
    signal,
  });

/** Report a picked Unsplash photo, as Unsplash's API terms require. */
export const triggerUnsplashPhotoDownload = (downloadUrl: string): Promise<void> =>
  sendApiRequest<void>("/api/internal/unsplash-photos/downloads", { method: "POST", body: { downloadUrl } });

/**
 * How long a save waits for its answer: 60 s. The write can queue for up to 10 s for its transaction and
 * then hold it for up to 20 s (`SURVEY_WRITE_TRANSACTION_OPTIONS`), after checks and custom CSS processing
 * of its own, so the shared 15 s mutation timeout would give up on saves that go on to land. Finite, so a
 * request that never answers still frees the autosave to try again.
 */
export const SURVEY_SAVE_TIMEOUT_MS = 60_000;

/** A full save's answer: the survey as stored, and whether this was the user's second publish. */
export type TSavedSurvey = TSurvey & { isSecondPublish: boolean };

const surveyPath = (surveyId: string) => `/api/internal/surveys/${encodeURIComponent(surveyId)}`;

/**
 * Save the whole survey, validated in full: the editor's save, publish and schedule, and the summary page's
 * status change and share settings. Answers the survey as stored.
 */
export const saveSurvey = async (survey: TSurvey): Promise<TSavedSurvey> =>
  reviveSurveyDates<TSavedSurvey>(
    await sendApiRequest<unknown>(surveyPath(survey.id), {
      method: "PUT",
      body: survey,
      timeoutMs: SURVEY_SAVE_TIMEOUT_MS,
    })
  );

/** Save a draft as it stands, from the draft save and the autosave. Answers the survey as stored. */
export const saveSurveyDraft = async (survey: TSurveyDraft): Promise<TSurvey> =>
  reviveSurveyDates(
    await sendApiRequest<unknown>(`${surveyPath(survey.id)}/draft`, {
      method: "PUT",
      body: survey,
      timeoutMs: SURVEY_SAVE_TIMEOUT_MS,
    })
  );

/** The workspace without its custom CSS, as the editor refreshes it when its tab comes back into view. */
export const getEditorWorkspace = async (workspaceId: string): Promise<TEditorWorkspace> =>
  reviveTimestamps(
    await getApiData<TEditorWorkspaceResource>(`/api/internal/workspaces/${encodeURIComponent(workspaceId)}`)
  );

/** The workspace's languages by code. The route leaves out the workspace, which the caller named. */
export const getWorkspaceLanguages = async (workspaceId: string): Promise<Language[]> =>
  (await getApiData<TLanguageResource[]>(buildApiUrl("/api/internal/languages", { workspaceId }))).map(
    (language) => ({ ...reviveTimestamps(language), workspaceId })
  );
