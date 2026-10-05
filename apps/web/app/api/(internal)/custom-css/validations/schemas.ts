import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { CUSTOM_CSS_LIMITS } from "@formbricks/types/custom-css";

const fields = {
  workspaceId: ZId,
  light: z.string().max(CUSTOM_CSS_LIMITS.workspace),
  dark: z.string().max(CUSTOM_CSS_LIMITS.workspace),
};

export const ZCustomCssValidation = z.discriminatedUnion("scope", [
  z.object({ ...fields, scope: z.literal("workspace") }).strict(),
  z.object({ ...fields, scope: z.literal("survey"), surveyId: ZId }).strict(),
]);
