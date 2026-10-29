import type { ActionClass } from "@formbricks/database/prisma-browser";
import type { TActionClassCreateBody } from "@/app/api/internal/action-classes/schemas";
import type { TUnsplashPhotoResource } from "@/app/api/internal/unsplash-photos/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The survey editor's calls to `/api/internal/*`. Each throws a `V3ApiError` on a refusal. Timestamps come
 * back as ISO strings and are revived to `Date`s here, so the editor's state keeps the types the page
 * rendered it with.
 */

type TWithJsonDates<T> = Omit<T, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

const reviveTimestamps = <T extends { createdAt: string; updatedAt: string }>(value: T) => ({
  ...value,
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
});

/** Create an action in the workspace, from the trigger picker. */
export const createActionClass = async (
  workspaceId: string,
  body: TActionClassCreateBody
): Promise<ActionClass> =>
  reviveTimestamps(
    await sendApiRequest<TWithJsonDates<ActionClass>>(
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
