import { z } from "zod";
import { ZStorageUrl } from "@formbricks/types/common";
import { WHITELABEL_IMAGE_URL_MAX_LENGTH } from "../lib/limits";

/** The favicon the organization's link surveys show: an uploaded image's storage path, or an http(s) URL. */
export const ZOrganizationFaviconPutBody = z
  .object({ faviconUrl: z.string().max(WHITELABEL_IMAGE_URL_MAX_LENGTH).pipe(ZStorageUrl) })
  .strict();

export type TOrganizationFaviconPutBody = z.infer<typeof ZOrganizationFaviconPutBody>;
