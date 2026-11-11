import type { ActionClass } from "@formbricks/database/prisma-browser";
import type { TActionClassCreateBody } from "@/app/api/internal/action-classes/schemas";
import type { TUnsplashPhotoResource } from "@/app/api/internal/unsplash-photos/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { type TJsonTimestamps, reviveTimestamps } from "@/modules/api/lib/json-timestamps";

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
