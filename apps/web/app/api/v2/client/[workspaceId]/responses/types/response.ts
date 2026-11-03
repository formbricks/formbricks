import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseInput, ZResponseMarkLowQuality } from "@formbricks/types/responses";

export const ZResponseInputV2 = ZResponseInput.omit({ userId: true }).extend({
  contactId: ZId.nullish(),
  recaptchaToken: z.string().nullish(),
  // ENG-6933: one way; see `ZResponseMarkLowQuality`.
  markLowQuality: ZResponseMarkLowQuality.optional(),
});
export type TResponseInputV2 = z.infer<typeof ZResponseInputV2>;
