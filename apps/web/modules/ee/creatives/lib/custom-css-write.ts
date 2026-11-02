import "server-only";
import type { TCustomCssInput } from "@formbricks/types/custom-css";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import {
  CustomCssInvalidError,
  CustomCssPlanRequiredError,
  classifyCustomCssSourceChange,
  previewCustomCss,
} from "@/modules/custom-css/lib/service";
import type { TCreativeType } from "./creative";
import { CREATIVE_CSS_SCOPE, getCreativeCssRoot } from "./custom-css";

/**
 * The plan gate and the processor for a write that sets a creative's own CSS to `next` over `previous`
 * (both source), behind the survey CSS gate (ENG-3865, ENG-3581). Adding or editing needs the plan
 * (Scale on Cloud) and one unit of the caller's custom CSS budget; removing it or sending it back
 * unchanged needs neither. Throws `CustomCssPlanRequiredError`, `CustomCssInvalidError` (with the
 * processor's located errors) or the rate limit's error.
 */
export const assertCreativeCustomCssWrite = async ({
  type,
  previous,
  next,
  organizationId,
  principal,
}: {
  type: TCreativeType;
  previous: TCustomCssInput | null | undefined;
  next: TCustomCssInput | null | undefined;
  organizationId: string;
  /** The user or API key the processing is charged to. */
  principal: string | null;
}): Promise<void> => {
  if (classifyCustomCssSourceChange(previous, next) !== "edit") return;
  if (!(await getCustomCssPlanAllowed(organizationId))) throw new CustomCssPlanRequiredError();
  if (principal) await applyRateLimit(rateLimitConfigs.api.v3CustomCss, principal);

  const result = previewCustomCss(CREATIVE_CSS_SCOPE, next ?? null, getCreativeCssRoot(type));
  if (!result.ok) throw new CustomCssInvalidError(result.errors);
};
