import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseInput } from "@formbricks/types/responses";
import { ZResponseNotShownInput } from "@formbricks/types/surveys/not-shown";

export const ZResponseInputV2 = ZResponseInput.omit({ userId: true }).extend({
  contactId: ZId.nullish(),
  recaptchaToken: z.string().nullish(),
  // The survey's not-shown record (ENG-6936), as on the v1 client create.
  notShown: ZResponseNotShownInput.optional(),
});
export type TResponseInputV2 = z.infer<typeof ZResponseInputV2>;
