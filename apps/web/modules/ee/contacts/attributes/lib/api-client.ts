import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import type { TContactAttributeKeyResource } from "@/app/api/internal/contact-attribute-keys/serializers";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The attributes page's writes to `/api/internal/contact-attribute-keys`. Each throws a `V3ApiError` on a
 * refusal, with the server's reason (a taken key, a default key, no Contacts licence) as its message. The
 * list is read from `GET /api/v3/contact-attribute-keys` (`v3-attribute-keys-client.ts`).
 */

const BASE_PATH = "/api/internal/contact-attribute-keys";

// A key belongs to the workspace's contact directory, so its writes name the workspace the page acts from;
// the key's own `workspaceId` only records where it was created.
const keyPath = (contactAttributeKeyId: string, workspaceId: string) =>
  buildApiUrl(`${BASE_PATH}/${encodeURIComponent(contactAttributeKeyId)}`, { workspaceId });

/** Add a custom attribute key to the workspace. */
export const createAttributeKey = (body: {
  workspaceId: string;
  key: string;
  name?: string;
  description?: string;
  dataType?: TContactAttributeDataType;
}) => sendApiRequest<TContactAttributeKeyResource>(BASE_PATH, { method: "POST", body });

/** Change a custom key's label and description; a field left out keeps its value. */
export const updateAttributeKey = (
  contactAttributeKeyId: string,
  workspaceId: string,
  body: { name?: string; description?: string }
) =>
  sendApiRequest<TContactAttributeKeyResource>(keyPath(contactAttributeKeyId, workspaceId), {
    method: "PATCH",
    body,
  });

/** Delete a custom attribute key. */
export const deleteAttributeKey = (contactAttributeKeyId: string, workspaceId: string) =>
  sendApiRequest<void>(keyPath(contactAttributeKeyId, workspaceId), { method: "DELETE" });
