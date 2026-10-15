import { z } from "zod";
import { ZOrganizationAccess } from "@formbricks/types/api-key";
import { ZApiKeyPermission } from "@formbricks/types/auth";

export const ZApiKeysQuery = z.object({ organizationId: z.cuid2() }).strict();
export type TApiKeysQuery = z.infer<typeof ZApiKeysQuery>;

export const ZApiKeyIdParams = z.object({ apiKeyId: z.cuid2() }).strict();
export type TApiKeyIdParams = z.infer<typeof ZApiKeyIdParams>;

/** Labels are free text; bounded like every other request string (ENG-1652), and never blank. */
const ZApiKeyLabel = z
  .string()
  .max(255)
  .refine((label) => label.trim().length > 0, { message: "The label can't be blank." });

const ZWorkspacePermission = z.object({ workspaceId: z.cuid2(), permission: ZApiKeyPermission }).strict();

/**
 * `POST /api/internal/api-keys?organizationId=` body. Which workspaces belong to the organization, and
 * whether the caller may grant organization access, are business rules checked by the operation.
 */
export const ZApiKeyCreateBody = z
  .object({
    label: ZApiKeyLabel,
    workspacePermissions: z.array(ZWorkspacePermission).optional(),
    organizationAccess: ZOrganizationAccess,
  })
  .strict()
  .superRefine((body, ctx) => {
    const workspaceIds = body.workspacePermissions?.map((entry) => entry.workspaceId) ?? [];
    if (new Set(workspaceIds).size !== workspaceIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["workspacePermissions"],
        message: "Each workspace can be listed once.",
      });
    }
  });
export type TApiKeyCreateBody = z.infer<typeof ZApiKeyCreateBody>;

/** `PATCH /api/internal/api-keys/{apiKeyId}` body. A key's permissions are fixed at creation. */
export const ZApiKeyUpdateBody = z.object({ label: ZApiKeyLabel }).strict();
export type TApiKeyUpdateBody = z.infer<typeof ZApiKeyUpdateBody>;
