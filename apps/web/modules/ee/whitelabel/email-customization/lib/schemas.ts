import { z } from "zod";
import { ZId, ZStorageUrl } from "@formbricks/types/common";

/**
 * The logo input of `updateOrganizationEmailLogoUrlAction`, kept out of the actions module so a test
 * parses this schema itself rather than whichever action happened to register first.
 */
export const ZUpdateOrganizationEmailLogoUrlAction = z.object({
  organizationId: ZId,
  logoUrl: ZStorageUrl,
});
