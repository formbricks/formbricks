import "server-only";
import { type TV3WorkspaceListParams, listV3WorkspaceResource } from "@/app/api/v3/lib/list-resource";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { serializeV3ContactAttributeKey } from "../serializers";

export function listV3ContactAttributeKeys(params: TV3WorkspaceListParams): Promise<Response> {
  const { requestId, instance } = params;
  return listV3WorkspaceResource({
    ...params,
    resourceName: "contact attribute keys",
    fetchAll: getContactAttributeKeys,
    serialize: serializeV3ContactAttributeKey,
    // Contact attribute keys belong to the enterprise Contacts feature — gate the list the same way
    // the UI and management API do, so an unentitled organization can't enumerate them through v3.
    assertEntitlement: async (workspaceId) => {
      const organization = await getOrganizationByWorkspaceId(workspaceId);
      if (organization && (await getIsContactsEnabled(organization.id))) {
        return null;
      }
      return problemForbidden(
        requestId,
        "The contacts feature is not enabled for this organization.",
        instance
      );
    },
  });
}
