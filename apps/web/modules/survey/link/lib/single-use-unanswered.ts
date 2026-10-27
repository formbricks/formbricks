import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getResponseBySingleUseId } from "@/modules/survey/link/lib/data";
import {
  type TLinkSurveySingleUseAccess,
  type TSingleUseSearchParam,
  getLinkSurveySingleUseAccess,
} from "@/modules/survey/link/lib/single-use-link";
import type { TSingleUseLinkSurface } from "@/modules/survey/link/lib/single-use-link-metrics";

/**
 * `getLinkSurveySingleUseAccess`, and a link that has already been answered is refused too.
 *
 * For the surfaces that hand out survey content without rendering a page: the PIN and verify-email actions,
 * and the page metadata. The page itself shows an answered link as "already answered", never the survey, so
 * these must answer for it the way they do for a link that was never valid. A used link stays valid (its
 * response is the one being resumed or shown), so on its own it would keep naming and fetching the survey
 * for whoever holds it (ENG-4041).
 *
 * "Answered" is a finished response, the same test the page applies. A partly answered link still resumes.
 */
export const getUnansweredLinkSurveySingleUseAccess = async ({
  survey,
  suId,
  suToken,
  surface,
}: {
  survey: Pick<TSurvey, "id" | "singleUse">;
  suId?: TSingleUseSearchParam;
  suToken?: TSingleUseSearchParam;
  surface: TSingleUseLinkSurface;
}): Promise<TLinkSurveySingleUseAccess> => {
  const access = getLinkSurveySingleUseAccess({ survey, suId, suToken, surface });
  if (!access.allowed || !access.singleUseId) {
    return access;
  }

  const response = await getResponseBySingleUseId(survey.id, access.singleUseId)();
  return response?.finished ? { allowed: false } : access;
};
