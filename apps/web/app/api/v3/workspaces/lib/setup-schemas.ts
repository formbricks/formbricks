import { z } from "zod";
import { ZColor, ZId } from "@formbricks/types/common";
import { ZWorkspaceConfigChannel, ZWorkspaceConfigIndustry } from "@formbricks/types/workspace";

const MAX_NAME_LENGTH = 255;
/** An image URL is a locator, not a payload: 2 KB is far past any real CDN link. */
const MAX_LOGO_URL_LENGTH = 2048;

const workspaceName = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const channel = ZWorkspaceConfigChannel.optional().describe(
  "Main way the workspace collects feedback: link, app or website. null clears it."
);
const industry = ZWorkspaceConfigIndustry.optional().describe(
  "Kind of product: eCommerce, saas or other. null clears it."
);

/** `create_workspace` body. The organization is the tenant the caller must own or manage. */
export const ZV3WorkspaceCreateBody = z
  .object({
    organizationId: ZId.describe(
      "Organization to create the workspace in. Take it from get_account_context."
    ),
    name: workspaceName.describe("Workspace name, unique within the organization."),
    channel,
    industry,
  })
  .strict();
export type TV3WorkspaceCreateBody = z.infer<typeof ZV3WorkspaceCreateBody>;

/** `update_workspace` body: at least one field. Branding has its own operation. */
export const ZV3WorkspaceUpdateBody = z
  .object({
    name: workspaceName.optional().describe("New workspace name."),
    channel,
    industry,
  })
  .strict();
export type TV3WorkspaceUpdateBody = z.infer<typeof ZV3WorkspaceUpdateBody>;

/** `set_workspace_branding` body: at least one field. */
export const ZV3WorkspaceBrandingBody = z
  .object({
    brandColor: ZColor.optional().describe(
      "Brand colour as a hex value such as #1e40af. Derives the matching survey colours (buttons, inputs, cards, progress bar, page background) from it."
    ),
    logoUrl: z
      .url({ protocol: /^https$/ })
      .max(MAX_LOGO_URL_LENGTH)
      .nullable()
      .optional()
      .describe(
        "https URL of the logo image (png, jpeg or webp, at most 1 MB). The server downloads it and stores a copy. null removes the current logo."
      ),
    logoBackgroundColor: ZColor.optional().describe(
      "Background colour shown behind the logo, as a hex value."
    ),
  })
  .strict();
export type TV3WorkspaceBrandingBody = z.infer<typeof ZV3WorkspaceBrandingBody>;

/** The minimal workspace a setup write answers with: never the raw entity (no styling, scripts or ids beyond its own). */
export const ZV3WorkspaceSetupResource = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  channel: ZWorkspaceConfigChannel,
  industry: ZWorkspaceConfigIndustry,
  updatedAt: z.string(),
});
export type TV3WorkspaceSetupResource = z.infer<typeof ZV3WorkspaceSetupResource>;

export const ZV3WorkspaceBrandingResource = z.object({
  workspaceId: z.string(),
  brandColor: z.string().nullable(),
  logoUrl: z.string().nullable(),
  logoBackgroundColor: z.string().nullable(),
  updatedAt: z.string(),
});
export type TV3WorkspaceBrandingResource = z.infer<typeof ZV3WorkspaceBrandingResource>;
