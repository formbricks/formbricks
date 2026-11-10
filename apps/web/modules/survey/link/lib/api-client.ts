import type { TActionClass } from "@formbricks/types/action-classes";
import type { TSegment } from "@formbricks/types/segment";
import type { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import type { TUserLocale } from "@formbricks/types/user";
import type { TLanguage } from "@formbricks/types/workspace";
import type { TLinkSurveyPinVerificationResource } from "@/app/api/internal/link-survey-pin-verifications/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The link-survey page's calls to `/api/internal/*`: the two gates a respondent passes before a survey opens.
 * Both run without a session, from the survey domain (`PUBLIC_URL`) that serves the page, and throw a
 * `V3ApiError` on a refusal.
 */

/** Whether a gate's refusal means the survey stopped taking responses (closed, archived or gone) after load. */
export const isLinkSurveyGoneApiError = (error: unknown): boolean =>
  error instanceof V3ApiError && error.status === 404;

/** What the verify-email screen sends. */
export type TLinkSurveyVerificationEmailRequest = {
  surveyId: string;
  email: string;
  locale: TUserLocale;
  suId?: string;
  suToken?: string;
  /** The language the respondent is reading the survey in, so the emailed link comes back to it. */
  surveyLanguageCode?: string;
};

/** Email the respondent the survey's verified link. No timeout: it sends the email before answering. */
export const sendLinkSurveyVerificationEmail = (body: TLinkSurveyVerificationEmailRequest) =>
  sendApiRequest<void>("/api/internal/link-survey-verification-emails", {
    method: "POST",
    body,
    timeoutMs: null,
  });

type TJsonTimestamps<T> = Omit<T, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

/** The survey as it crosses the wire: every timestamp an ISO string. */
type TLinkSurveyJson = Omit<
  TSurvey,
  | "createdAt"
  | "updatedAt"
  | "visibilityChangedAt"
  | "publishOn"
  | "closeOn"
  | "archivedAt"
  | "languages"
  | "triggers"
  | "segment"
  | "followUps"
> & {
  createdAt: string;
  updatedAt: string;
  visibilityChangedAt: string | null;
  publishOn: string | null;
  closeOn: string | null;
  archivedAt?: string | null;
  languages: (Omit<TSurveyLanguage, "language"> & { language: TJsonTimestamps<TLanguage> })[];
  triggers: { actionClass: TJsonTimestamps<TActionClass> }[];
  segment: TJsonTimestamps<TSegment> | null;
  followUps: TJsonTimestamps<TSurvey["followUps"][number]>[];
};

type TLinkSurveyPinVerificationJson = Omit<TLinkSurveyPinVerificationResource, "survey"> & {
  survey: TLinkSurveyJson;
};

const toDate = (value: string | null | undefined): Date | null => (value ? new Date(value) : null);

const reviveTimestamps = <T extends { createdAt: string; updatedAt: string }>(value: T) => ({
  ...value,
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
});

/** The survey with its timestamps as `Date`s again, as the server action handed it over. */
const reviveLinkSurvey = (survey: TLinkSurveyJson): TSurvey => ({
  ...survey,
  createdAt: new Date(survey.createdAt),
  updatedAt: new Date(survey.updatedAt),
  visibilityChangedAt: toDate(survey.visibilityChangedAt),
  publishOn: toDate(survey.publishOn),
  closeOn: toDate(survey.closeOn),
  archivedAt: toDate(survey.archivedAt),
  languages: survey.languages.map((language) => ({
    ...language,
    language: reviveTimestamps(language.language),
  })),
  triggers: survey.triggers.map((trigger) => ({ actionClass: reviveTimestamps(trigger.actionClass) })),
  segment: survey.segment ? reviveTimestamps(survey.segment) : null,
  followUps: survey.followUps.map(reviveTimestamps),
});

/**
 * Check the PIN typed on the PIN screen. On a match: the survey (without its PIN), its compiled custom CSS,
 * and for a PIN-protected survey the token the response routes accept. A wrong PIN is a 422.
 */
export const verifyLinkSurveyPin = async (body: {
  surveyId: string;
  pin: string;
  suId?: string;
  suToken?: string;
}): Promise<TLinkSurveyPinVerificationResource> => {
  const { survey, ...rest } = await sendApiRequest<TLinkSurveyPinVerificationJson>(
    "/api/internal/link-survey-pin-verifications",
    { method: "POST", body }
  );
  return { ...rest, survey: reviveLinkSurvey(survey) };
};
