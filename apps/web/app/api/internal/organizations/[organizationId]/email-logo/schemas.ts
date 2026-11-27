import { z } from "zod";
import { ZStorageUrl } from "@formbricks/types/common";
import { WHITELABEL_IMAGE_URL_MAX_LENGTH } from "../lib/limits";

/**
 * The logo the organization's emails show in their header: an uploaded image's storage path, or an http(s)
 * URL (`ZStorageUrl`, as the server action this route replaces checks since #10033), bounded in length.
 */
export const ZOrganizationEmailLogoPutBody = z
  .object({ logoUrl: z.string().max(WHITELABEL_IMAGE_URL_MAX_LENGTH).pipe(ZStorageUrl) })
  .strict();

export type TOrganizationEmailLogoPutBody = z.infer<typeof ZOrganizationEmailLogoPutBody>;
