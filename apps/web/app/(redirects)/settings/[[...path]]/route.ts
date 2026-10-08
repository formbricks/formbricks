import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { handleMarketingRedirect } from "@/modules/settings/lib/marketing-redirect-handler";
import { getSettingsDestination } from "@/modules/settings/lib/marketing-redirects";

// Stable marketing link: /settings[/<page>] opens that settings page for the organization (or workspace)
// the user is currently in; see getSettingsDestination.
export const GET = async (request: Request, context: { params: Promise<{ path?: string[] }> }) => {
  const { path } = await context.params;
  return handleMarketingRedirect(request, getSettingsDestination(path, IS_FORMBRICKS_CLOUD));
};
