import { z } from "zod";
import { WHITELABEL_IMAGE_URL_MAX_LENGTH } from "../lib/limits";

/**
 * The logo the organization's emails show in their header: the URL of an uploaded image. Any string, as
 * the server action this route replaces accepted, bounded in length.
 */
export const ZOrganizationEmailLogoPutBody = z
  .object({ logoUrl: z.string().max(WHITELABEL_IMAGE_URL_MAX_LENGTH) })
  .strict();

export type TOrganizationEmailLogoPutBody = z.infer<typeof ZOrganizationEmailLogoPutBody>;
