import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import type { TContactAttributeKeyResource } from "@/app/api/internal/contact-attribute-keys/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The attributes page's writes to `/api/internal/contact-attribute-keys`. Each throws a `V3ApiError` on a
 * refusal, with the server's reason (a taken key, a default key, no Contacts licence) as its message. The
 * list is read from `GET /api/v3/contact-attribute-keys` (`v3-attribute-keys-client.ts`).
 */

const BASE_PATH = "/api/internal/contact-attribute-keys";

const keyPath = (contactAttributeKeyId: string) =>
  `${BASE_PATH}/${encodeURIComponent(contactAttributeKeyId)}`;

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
  body: { name?: string; description?: string }
) => sendApiRequest<TContactAttributeKeyResource>(keyPath(contactAttributeKeyId), { method: "PATCH", body });

/** Delete a custom attribute key. */
export const deleteAttributeKey = (contactAttributeKeyId: string) =>
  sendApiRequest<void>(keyPath(contactAttributeKeyId), { method: "DELETE" });
