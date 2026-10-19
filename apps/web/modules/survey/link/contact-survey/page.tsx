import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getExistingContactResponse } from "@/modules/survey/link/lib/data";
import { getServableLinkSurvey } from "@/modules/survey/link/lib/servable-survey";
import { resolveSingleUseIdForSurvey } from "@/modules/survey/link/lib/single-use-link";
import type { TLinkSurveySearchParams } from "@/modules/survey/link/lib/types";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getWorkspaceById } from "@/modules/survey/link/lib/workspace";
import { getGenericContactSurveyMetadata, getMetadataForContactSurvey } from "@/modules/survey/link/metadata";

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
      return getGenericContactSurveyMetadata();
    }
    return await getMetadataForContactSurvey(result.data.surveyId, await getAcceptedLanguages());
  } catch {
    // A token or lookup failure still gets generic metadata rather than an error page.
    return getGenericContactSurveyMetadata();
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

  // ENG-3228: the link-survey loader, not the authenticated one: this page renders the survey into a client
  // component for whoever opens the contact link. Only a survey this page may serve comes back, so neither
  // early return below can confirm that a non-public one exists (ENG-4032).
  const existingResponse = await getExistingContactResponse(surveyId, contactId)();
  if (existingResponse) {
    const survey = await getServableLinkSurvey(surveyId);
    if (!survey) {
      notFound();
    }
    const workspace = await getWorkspaceById(survey.workspaceId);
    return <SurveyInactive status="response submitted" workspace={workspace || undefined} />;
  }

  const isPreview = preview === "true";
  const survey = await getServableLinkSurvey(surveyId);
  if (!survey) {
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
