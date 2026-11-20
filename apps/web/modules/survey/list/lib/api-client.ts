import type { TSurveyCopyResource } from "@/app/api/internal/surveys/[surveyId]/copies/serializers";
import type { TSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The survey list's writes to `/api/internal/surveys/{surveyId}/…`, shared with the summary page and its
 * share modal. Each throws a `V3ApiError` on a refusal, with the server's reason (a survey limit, custom head
 * scripts the caller may not carry over) as its message where there is one.
 */

const surveyPath = (surveyId: string, resource: string) =>
  `/api/internal/surveys/${encodeURIComponent(surveyId)}/${resource}`;

/** Copy a survey into a workspace of its organization; its own workspace duplicates it. */
export const copySurvey = ({
  surveyId,
  targetWorkspaceId,
}: {
  surveyId: string;
  targetWorkspaceId: string;
}) =>
  sendApiRequest<TSurveyCopyResource>(surveyPath(surveyId, "copies"), {
    method: "POST",
    body: { targetWorkspaceId },
  });

/**
 * Mint signed single-use link parameters for a survey: `count` of them, encrypted or not, or the one link
 * for a custom id (unencrypted, one at a time).
 */
export const generateSingleUseLinks = ({
  surveyId,
  ...body
}: {
  surveyId: string;
  isEncrypted: boolean;
  count?: number;
  singleUseId?: string;
}) =>
  sendApiRequest<TSurveySingleUseLinkParams[]>(surveyPath(surveyId, "single-use-links"), {
    method: "POST",
    body,
  });
