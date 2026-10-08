import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { handleMarketingRedirect } from "@/modules/settings/lib/marketing-redirect-handler";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";

// Stable marketing link: /billing opens billing (cloud) or enterprise (self-hosted) settings of the
// organization the user is currently in.
export const GET = (request: Request) =>
  handleMarketingRedirect(request, {
    scope: "organization",
    buildPath: (id) => getOrganizationBillingPath(id, IS_FORMBRICKS_CLOUD),
  });
