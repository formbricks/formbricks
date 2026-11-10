import type { TDisplayWithContact } from "@formbricks/types/displays";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurveySummary } from "@formbricks/types/surveys/types";
import type { TSurveyDisplayResource } from "@/app/api/internal/surveys/[surveyId]/displays/serializers";
import type { TSurveyEmailEmbedResource } from "@/app/api/internal/surveys/[surveyId]/email-embed/serializers";
import type { TSurveyExampleResponsesResource } from "@/app/api/internal/surveys/[surveyId]/example-responses/serializers";
import type { TSurveyPersonalLinksResource } from "@/app/api/internal/surveys/[surveyId]/personal-links/serializers";
import type { TSurveyResetResource } from "@/app/api/internal/surveys/[surveyId]/resets/serializers";
import type { TSurveySingleUseSettingsResource } from "@/app/api/internal/surveys/[surveyId]/single-use-settings/serializers";
import type {
  TSurveySummaryItemResource,
  TSurveySummaryResource,
} from "@/app/api/internal/surveys/[surveyId]/summary/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The survey summary's and its share modal's calls to `/api/internal/surveys/{surveyId}/…`. Each throws a
 * `V3ApiError` on a refusal, with the server's reason (an archived survey, an AI gate's error code, a
 * personal-link error code) as its message where there is one. Timestamps in what they read come back as
 * ISO strings and are revived to `Date`s here, so the page keeps the types it renders.
 */

const surveyPath = (surveyId: string, resource: string) =>
  `/api/internal/surveys/${encodeURIComponent(surveyId)}/${resource}`;

type TSurveySummaryItem = TSurveySummary["summary"][number];

const reviveSample = <T extends { updatedAt: string }>({
  updatedAt,
  ...sample
}: T): Omit<T, "updatedAt"> & { updatedAt: Date } => ({ ...sample, updatedAt: new Date(updatedAt) });

const reviveSummaryItem = (item: TSurveySummaryItemResource): TSurveySummaryItem => {
  switch (item.type) {
    case TSurveyElementTypeEnum.OpenText:
      return { ...item, samples: item.samples.map(reviveSample) };
    case TSurveyElementTypeEnum.Date:
      return { ...item, samples: item.samples.map(reviveSample) };
    case TSurveyElementTypeEnum.Address:
      return { ...item, samples: item.samples.map(reviveSample) };
    case TSurveyElementTypeEnum.ContactInfo:
      return { ...item, samples: item.samples.map(reviveSample) };
    case "hiddenField":
      return { ...item, samples: item.samples.map(reviveSample) };
    case TSurveyElementTypeEnum.FileUpload:
      return { ...item, files: item.files.map(reviveSample) };
    case TSurveyElementTypeEnum.Signature:
      return { ...item, signatures: item.signatures.map(reviveSample) };
    default:
      return item;
  }
};

/**
 * The survey's summary over the responses matching the filter. A read sent as `POST` because the filter
 * travels in the body; it walks every matching response, so it waits as long as the server takes.
 */
export const querySurveySummary = async ({
  surveyId,
  filterCriteria,
}: {
  surveyId: string;
  filterCriteria: TResponseFilterCriteria;
}): Promise<TSurveySummary> => {
  const summary = await sendApiRequest<TSurveySummaryResource>(surveyPath(surveyId, "summary/queries"), {
    method: "POST",
    body: { filterCriteria },
    timeoutMs: null,
  });
  return { ...summary, summary: summary.summary.map(reviveSummaryItem) };
};

/** A page of the survey's displays to known contacts, newest first, for the Impressions tab. */
export const listSurveyDisplays = async ({
  surveyId,
  limit,
  offset,
}: {
  surveyId: string;
  limit: number;
  offset: number;
}): Promise<TDisplayWithContact[]> => {
  const displays = await getApiData<TSurveyDisplayResource[]>(
    buildApiUrl(surveyPath(surveyId, "displays"), { limit, offset })
  );
  return displays.map((display) => ({ ...display, createdAt: new Date(display.createdAt) }));
};

/** The survey rendered as an email body, for the Email tab's preview and embed code. */
export const getSurveyEmailEmbed = (surveyId: string, signal?: AbortSignal) =>
  getApiData<TSurveyEmailEmbedResource>(surveyPath(surveyId, "email-embed"), { signal });

/** Email the signed-in user the survey's email embed. Sends an email, so it waits as long as it takes. */
export const sendSurveyPreviewEmail = (surveyId: string) =>
  sendApiRequest<{ emailSent: boolean }>(surveyPath(surveyId, "preview-emails"), {
    method: "POST",
    timeoutMs: null,
  });

/** Delete every response and display of the survey. */
export const resetSurvey = (surveyId: string) =>
  sendApiRequest<TSurveyResetResource>(surveyPath(surveyId, "resets"), { method: "POST" });

/** Write AI-generated example responses into a survey with none. LLM calls: it can run for minutes. */
export const generateExampleResponses = (surveyId: string) =>
  sendApiRequest<TSurveyExampleResponsesResource>(surveyPath(surveyId, "example-responses"), {
    method: "POST",
    timeoutMs: null,
  });

/** A CSV of personal links for a segment's contacts; a large segment takes a while. */
export const generatePersonalLinks = ({
  surveyId,
  ...body
}: {
  surveyId: string;
  segmentId: string;
  expirationDays?: number;
}) =>
  sendApiRequest<TSurveyPersonalLinksResource>(surveyPath(surveyId, "personal-links"), {
    method: "POST",
    body,
    timeoutMs: null,
  });

/** Switch the survey's link between multi-use and single-use, and its single-use ids' encryption. */
export const saveSingleUseSettings = ({
  surveyId,
  ...body
}: {
  surveyId: string;
  enabled: boolean;
  isEncrypted: boolean;
}) =>
  sendApiRequest<TSurveySingleUseSettingsResource>(surveyPath(surveyId, "single-use-settings"), {
    method: "PUT",
    body,
  });
