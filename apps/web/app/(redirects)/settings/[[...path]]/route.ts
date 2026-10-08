import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { handleMarketingRedirect } from "@/modules/settings/lib/marketing-redirect-handler";
import { getSettingsRedirectPath } from "@/modules/settings/lib/marketing-redirects";

// Stable marketing link: /settings[/...] opens that settings page of the organization the user is
// currently in (account pages like /settings/profile go to /account/settings/*).
export const GET = async (request: Request, context: { params: Promise<{ path?: string[] }> }) => {
  const { path } = await context.params;
  return handleMarketingRedirect(request, {
    scope: "organization",
    buildPath: (id) => getSettingsRedirectPath(id, path, IS_FORMBRICKS_CLOUD),
  });
};
