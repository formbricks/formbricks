import "server-only";
import { logger } from "@formbricks/logger";
import { normalizeHex } from "@formbricks/types/colors";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TWorkspace, TWorkspaceStyling } from "@formbricks/types/workspace";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import {
  problemConflict,
  problemServiceUnavailable,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { problemHiddenResource } from "@/app/api/v3/organizations/lib/access";
import { buildStylingFromBrandColor } from "@/lib/styling/constants";
import { getWorkspace } from "@/lib/workspace/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import {
  LogoImageError,
  LogoStorageError,
  discardStoredLogo,
  downloadLogoImage,
  storeLogoImage,
} from "./branding-logo";
import { requireV3WorkspaceSetupAccess } from "./setup-access";
import { rejectEmptyChange } from "./setup-input";
import { type TV3WorkspaceBrandingResource, ZV3WorkspaceBrandingBody } from "./setup-schemas";

/**
 * The styling keys a brand colour derives. Everything else (fonts, radii, sizes, arrangement, anything
 * the person tuned by hand) is left as stored, so choosing a brand colour never resets the rest.
 */
const BRAND_DERIVED_STYLING_KEYS = [
  "brandColor",
  "elementHeadlineColor",
  "elementDescriptionColor",
  "elementUpperLabelColor",
  "buttonBgColor",
  "buttonTextColor",
  "inputBgColor",
  "inputBorderColor",
  "inputTextColor",
  "optionBgColor",
  "optionLabelColor",
  "optionBorderColor",
  "cardBackgroundColor",
  "cardBorderColor",
  "highlightBorderColor",
  "progressIndicatorBgColor",
  "progressTrackBgColor",
  "background",
] as const satisfies ReadonlyArray<keyof TWorkspaceStyling>;

/** The stored styling with the colours a brand colour derives replaced, and nothing else touched. */
export const applyBrandColorToStyling = (
  current: TWorkspaceStyling | null | undefined,
  brandColor: string
): TWorkspaceStyling => {
  const derived = buildStylingFromBrandColor(brandColor);
  const next: TWorkspaceStyling = { ...current, allowStyleOverwrite: current?.allowStyleOverwrite ?? true };
  for (const key of BRAND_DERIVED_STYLING_KEYS) {
    Object.assign(next, { [key]: derived[key] });
  }
  return next;
};

/** The minimal DTO a branding write answers with. */
export const serializeBranding = (workspace: TWorkspace): TV3WorkspaceBrandingResource => ({
  workspaceId: workspace.id,
  brandColor: workspace.styling?.brandColor?.light ?? null,
  logoUrl: workspace.logo?.url ?? null,
  logoBackgroundColor: workspace.logo?.bgColor ?? null,
  updatedAt: workspace.updatedAt.toISOString(),
});

type TBrandingParams = {
  workspaceId: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Set a workspace's brand colour and/or logo. Research is the agent's job; this only writes what it was
 * given. A logo is given as an https URL: the server downloads it behind the webhook SSRF guard, caps its
 * size and type, stores its own copy and, when it replaces a stored logo, deletes the old object through
 * `updateWorkspace`'s existing ownership guards.
 */
export async function setV3WorkspaceBranding({
  workspaceId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TBrandingParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  let storedLogoUrl: string | null = null;
  let attached = false;

  try {
    const parsed = parseV3Body(ZV3WorkspaceBrandingBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { brandColor, logoUrl, logoBackgroundColor } = parsed.data;
    const empty = rejectEmptyChange({ brandColor, logoUrl, logoBackgroundColor }, requestId, instance);
    if (empty) return empty;

    const context = await requireV3WorkspaceSetupAccess(authentication, workspaceId, requestId, instance);
    if (context instanceof Response) {
      return context;
    }

    if (auditLog) {
      auditLog.organizationId = context.organizationId;
      auditLog.targetId = context.workspaceId;
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, context.workspaceId);

    const previous = await getWorkspace(context.workspaceId);
    if (!previous) {
      return problemHiddenResource(requestId, instance);
    }

    const normalizedBrandColor = brandColor === undefined ? undefined : normalizeHex(brandColor);
    if (brandColor !== undefined && !normalizedBrandColor) {
      return problemUnprocessableContent(requestId, "Invalid brand colour", {
        invalid_params: [{ name: "brandColor", reason: "Not a hex colour" }],
        instance,
      });
    }

    const touchesLogo = logoUrl !== undefined || logoBackgroundColor !== undefined;
    let nextLogoUrl = previous.logo?.url;
    if (typeof logoUrl === "string") {
      storedLogoUrl = await storeLogoImage(context.workspaceId, await downloadLogoImage(logoUrl));
      nextLogoUrl = storedLogoUrl;
    } else if (logoUrl === null) {
      nextLogoUrl = undefined;
    }

    const updated = await updateWorkspace(context.workspaceId, {
      ...(normalizedBrandColor
        ? { styling: applyBrandColorToStyling(previous.styling, normalizedBrandColor) }
        : {}),
      // `logo` carries a url and a colour together, so a write to either sends both and the save is
      // version-checked: a stale baseline would restore a url whose object was just deleted.
      ...(touchesLogo
        ? {
            logo: {
              ...(nextLogoUrl ? { url: nextLogoUrl } : {}),
              ...((logoBackgroundColor ?? previous.logo?.bgColor)
                ? { bgColor: logoBackgroundColor ?? previous.logo?.bgColor }
                : {}),
            },
            expectedUpdatedAt: previous.updatedAt,
          }
        : {}),
    });
    attached = true;

    if (auditLog) {
      auditLog.oldObject = serializeBranding(previous);
      auditLog.newObject = serializeBranding(updated);
    }

    log.info({ statusCode: 200, logoChanged: typeof logoUrl === "string" }, "Workspace branding saved");
    return successResponse(serializeBranding(updated), { requestId, cache: "private, no-store" });
  } catch (error) {
    if (error instanceof LogoImageError) {
      log.warn({ statusCode: 422 }, "Workspace logo rejected");
      return problemUnprocessableContent(requestId, error.message, {
        invalid_params: [{ name: "logoUrl", reason: error.message }],
        instance,
      });
    }
    if (error instanceof LogoStorageError) {
      return problemServiceUnavailable(requestId, error.message, instance);
    }
    if (error instanceof OperationNotAllowedError) {
      // The version check in `updateWorkspace`: someone saved this workspace after it was read here.
      return problemConflict(
        requestId,
        "The workspace changed while saving. Read it again and retry.",
        instance
      );
    }
    return mapV3ThrownError(error, { log, requestId, instance, operation: "workspaces.branding" });
  } finally {
    if (storedLogoUrl && !attached) {
      await discardStoredLogo(workspaceId, storedLogoUrl);
    }
  }
}
