import type { TResponseWithQuotas } from "@formbricks/types/responses";
import type { TResponseCardResource, TResponseTagResource } from "@/app/api/internal/responses/serializers";
import type { TTagResource } from "@/app/api/internal/tags/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { reviveTimestamps } from "@/modules/api/lib/json-timestamps";

/**
 * The response card's calls to `/api/internal/*`: read and delete a response, create a tag, and put tags on
 * a response or take them off. Each throws a `V3ApiError` on a refusal. The response's timestamps come back
 * as ISO strings and are revived to `Date`s here, so the card keeps the types the page rendered it with.
 */

const responsePath = (responseId: string) => `/api/internal/responses/${encodeURIComponent(responseId)}`;

const responseTagPath = (responseId: string, tagId: string) =>
  `${responsePath(responseId)}/tags/${encodeURIComponent(tagId)}`;

/** A response as the card routes send it, with its timestamps (and its tags') back as `Date`s. */
export const reviveResponse = (response: TResponseCardResource): TResponseWithQuotas => ({
  ...reviveTimestamps(response),
  tags: response.tags.map(reviveTimestamps),
});

/** A response as the card renders it, with its screened-in quotas. */
export const getResponseCard = async (
  responseId: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TResponseWithQuotas> =>
  reviveResponse(await getApiData<TResponseCardResource>(responsePath(responseId), { signal }));

/** Delete a response, giving its quota places back when `decrementQuotas` is set. */
export const deleteResponse = (responseId: string, { decrementQuotas }: { decrementQuotas: boolean }) =>
  sendApiRequest<void>(buildApiUrl(responsePath(responseId), { decrementQuotas: decrementQuotas || null }), {
    method: "DELETE",
  });

/** Create a tag in the workspace. A name the workspace already has is refused with a 409. */
export const createTag = (workspaceId: string, name: string) =>
  sendApiRequest<TTagResource>("/api/internal/tags", { method: "POST", body: { workspaceId, name } });

/** Put a tag on a response; one already on it answers the same. */
export const addResponseTag = (responseId: string, tagId: string) =>
  sendApiRequest<TResponseTagResource>(responseTagPath(responseId, tagId), { method: "PUT" });

/** Take a tag off a response. */
export const removeResponseTag = (responseId: string, tagId: string) =>
  sendApiRequest<void>(responseTagPath(responseId, tagId), { method: "DELETE" });
