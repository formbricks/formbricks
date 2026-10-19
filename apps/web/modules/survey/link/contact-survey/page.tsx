import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import {
  type TLinkSurvey,
  getExistingContactResponse,
  getSurveyWithMetadata,
} from "@/modules/survey/link/lib/data";
import { isLinkSurveyServable } from "@/modules/survey/link/lib/public-access";
import { resolveSingleUseIdForSurvey } from "@/modules/survey/link/lib/single-use-link";
import type { TLinkSurveySearchParams } from "@/modules/survey/link/lib/types";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getWorkspaceById } from "@/modules/survey/link/lib/workspace";
import { GENERIC_CONTACT_SURVEY_METADATA, getMetadataForContactSurvey } from "@/modules/survey/link/metadata";

interface ContactSurveyPageProps {
  params: Promise<{
    jwt: string;
  }>;
  searchParams: Promise<TLinkSurveySearchParams>;
}

export const generateMetadata = async (props: ContactSurveyPageProps): Promise<Metadata> => {
  const { jwt } = await props.params;
  try {
    const result = verifyContactSurveyToken(jwt);
    if (!result.ok) {
      return GENERIC_CONTACT_SURVEY_METADATA;
    }
    return await getMetadataForContactSurvey(result.data.surveyId, await getAcceptedLanguages());
  } catch {
    // A token or lookup failure still gets generic metadata rather than an error page.
    return GENERIC_CONTACT_SURVEY_METADATA;
  }
};

export const ContactSurveyPage = async (props: ContactSurveyPageProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const t = await getTranslate();
  const { jwt } = params;
  const { preview, suId, suToken } = searchParams;

  const result = verifyContactSurveyToken(jwt);
  if (!result.ok) {
    if (
      result.error.type === "bad_request" &&
      result.error.details?.some((detail) => detail.issue === "token_expired")
    ) {
      return <SurveyInactive surveyClosedMessage={{ heading: t("c.link_expired") }} status="link expired" />;
    }
    // When token is invalid, we don't have survey data to get workspace branding settings
    // So we show SurveyInactive without workspace data (shows branding by default for backward compatibility)
    return <SurveyInactive status="link invalid" />;
  }

  const { surveyId, contactId } = result.data;

  // ENG-3228: the link-survey loader, not the authenticated one. This page renders the survey into a
  // client component for whoever opens the contact link, so it is a respondent-facing reader and must
  // take the selector that omits the workspace-library row id — the same one `/s/<surveyId>` and the
  // v1 client environment use. It also blanks follow-ups and segment filters, which do not belong in
  // a respondent's page payload either. It throws where the authenticated loader returned null, so
  // both call sites below catch, mirroring `link/page.tsx`.
  const loadSurvey = async (): Promise<TLinkSurvey | null> => {
    try {
      return await getSurveyWithMetadata(surveyId);
    } catch (error) {
      // Logged rather than rethrown, and logged rather than swallowed silently: this loader turns a
      // Prisma failure into `DatabaseError`, which is indistinguishable here from the survey simply
      // being gone, and a respondent gets the same 404 either way. `link/page.tsx` treats its own
      // load the same way, so the two pages fail alike; the log is what tells an outage apart.
      logger.error(error, "Error fetching survey for contact link");
      return null;
    }
  };

  const existingResponse = await getExistingContactResponse(surveyId, contactId)();
  if (existingResponse) {
    const survey = await loadSurvey();
    // Same gate as below: a survey that is no longer public 404s instead of confirming it exists (ENG-4032).
    if (survey && !isLinkSurveyServable(survey)) {
      notFound();
    }
    if (survey) {
      const workspace = await getWorkspaceById(survey.workspaceId);
      return <SurveyInactive status="response submitted" workspace={workspace || undefined} />;
    }
    return <SurveyInactive status="response submitted" />;
  }

  const isPreview = preview === "true";
  const survey = await loadSurvey();

  // Gate before the single-use early return, which would otherwise tell the token holder that a draft,
  // archived or non-link survey exists (ENG-4032). renderSurvey checks again.
  if (!survey || !isLinkSurveyServable(survey)) {
    notFound();
  }

  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;

  let singleUseId: string | undefined = undefined;

  if (isSingleUseSurvey) {
    const validatedSingleUseId = resolveSingleUseIdForSurvey({
      surveyId: survey.id,
      isEncrypted: Boolean(isSingleUseSurveyEncrypted),
      suId,
      suToken,
      surface: "contact_link_page",
    });
    if (!validatedSingleUseId) {
      const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
      return <SurveyInactive status="link invalid" workspace={workspaceContext.workspace} />;
    }

    singleUseId = validatedSingleUseId;
  }

  // Parallel fetch of workspace context, locale and the respondent's browser languages
  const [workspaceContext, locale, acceptedLanguages, singleUseResponse] = await Promise.all([
    getWorkspaceContextForLinkSurvey(survey.workspaceId),
    findMatchingLocale(),
    getAcceptedLanguages(),
    // Fetch existing response for this contact
    getExistingContactResponse(survey.id, contactId)(),
  ]);

  // Fetch responseCount only if needed
  const responseCount = survey.welcomeCard.showResponseCount
    ? await getResponseCountBySurveyId(survey.id)
    : undefined;

  return renderSurvey({
    survey,
    searchParams,
    contactId,
    isPreview,
    singleUseId,
    singleUseResponse,
    workspaceContext,
    locale,
    acceptedLanguages,
    responseCount,
  });
};
