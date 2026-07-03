import { notFound } from "next/navigation";
import { type Response } from "@formbricks/database/prisma-browser";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import {
  IMPRINT_URL,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PRIVACY_URL,
  RECAPTCHA_SITE_KEY,
  TERMS_URL,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { PinScreen } from "@/modules/survey/link/components/pin-screen";
import { SurveyClientWrapper } from "@/modules/survey/link/components/survey-client-wrapper";
import { SurveyCompletedMessage } from "@/modules/survey/link/components/survey-completed-message";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { VerifyEmail } from "@/modules/survey/link/components/verify-email";
import { getEmailVerificationDetails } from "@/modules/survey/link/lib/helper";
import type { TLinkSurveySearchParams } from "@/modules/survey/link/lib/types";
import { hasUserIdSearchParam } from "@/modules/survey/link/lib/user-id";
import { TWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";

interface SurveyRendererProps {
  survey: TSurvey;
  searchParams: TLinkSurveySearchParams;
  singleUseId?: string;
  singleUseResponse?: Pick<Response, "id" | "finished">;
  contactId?: string;
  allowUrlUserIdLookup?: boolean;
  isPreview: boolean;
  // New props - pre-fetched in parent
  workspaceContext: TWorkspaceContextForLinkSurvey;
  locale: TUserLocale;
  responseCount?: number;
  // Response data resolved from a prefill token (server-side), used to prefill answers
  prefillResponseData?: TResponseData;
}

/**
 * Renders link survey with pre-fetched data from parent.
 *
 * This function receives all necessary data as props to avoid additional
 * database queries. The parent (page.tsx) fetches data in parallel stages
 * to minimize latency for users geographically distant from servers.
 *
 * @param workspaceContext - Pre-fetched workspace and organization data
 * @param locale - User's locale from Accept-Language header
 * @param responseCount - Conditionally fetched if showResponseCount is enabled
 */
export const renderSurvey = async ({
  survey,
  searchParams,
  singleUseId,
  singleUseResponse,
  contactId,
  allowUrlUserIdLookup = false,
  isPreview,
  workspaceContext,
  locale,
  responseCount,
  prefillResponseData,
}: SurveyRendererProps) => {
  const langParam = searchParams.lang;
  const isEmbed = searchParams.embed === "true";

  if (survey.status === "draft" || survey.type !== "link") {
    notFound();
  }

  // Extract workspace from pre-fetched context
  const { workspace } = workspaceContext;

  const isSpamProtectionEnabled = Boolean(IS_RECAPTCHA_CONFIGURED && survey.recaptcha?.enabled);
  const isScheduled = survey.status === "paused" && survey.publishOn !== null;

  if (survey.status !== "inProgress") {
    return (
      <SurveyInactive
        status={survey.status}
        isScheduled={isScheduled}
        surveyClosedMessage={survey.surveyClosedMessage}
        workspace={workspace}
      />
    );
  }

  // Check if single-use survey has already been completed
  if (singleUseResponse?.finished) {
    return <SurveyCompletedMessage singleUseMessage={survey.singleUse} workspace={workspace} />;
  }

  // Handle email verification flow if enabled
  let emailVerificationStatus = "";
  let verifiedEmail: string | undefined = undefined;

  if (survey.isVerifyEmailEnabled) {
    const token = searchParams.verify;

    if (token) {
      const emailVerificationDetails = await getEmailVerificationDetails(survey.id, token);
      emailVerificationStatus = emailVerificationDetails.status;
      verifiedEmail = emailVerificationDetails.email;
    }
  }

  if (survey.isVerifyEmailEnabled && emailVerificationStatus !== "verified" && !isPreview) {
    if (emailVerificationStatus === "fishy") {
      return (
        <VerifyEmail
          survey={survey}
          isErrorComponent={true}
          languageCode={getLanguageCode(langParam, survey)}
          styling={workspace.styling}
          locale={locale}
        />
      );
    }
    return (
      <VerifyEmail
        singleUseId={searchParams.suId ?? ""}
        singleUseToken={searchParams.suToken}
        survey={survey}
        languageCode={getLanguageCode(langParam, survey)}
        styling={workspace.styling}
        locale={locale}
      />
    );
  }

  // Compute final styling based on workspace and survey settings
  const styling = computeStyling(workspace.styling, survey.styling);
  const languageCode = getLanguageCode(langParam, survey);
  const publicDomain = getPublicDomain();
  const canReadUserIdFromUrl =
    allowUrlUserIdLookup && !contactId && hasUserIdSearchParam(searchParams)
      ? await getIsContactsEnabled(workspaceContext.organizationId)
      : false;

  // Handle PIN-protected surveys
  if (survey.pin) {
    return (
      <PinScreen
        surveyId={survey.id}
        styling={styling}
        publicDomain={publicDomain}
        workspace={workspace}
        singleUseId={singleUseId}
        singleUseResponse={singleUseResponse}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        TERMS_URL={TERMS_URL}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        verifiedEmail={verifiedEmail}
        languageCode={languageCode}
        isEmbed={isEmbed}
        isPreview={isPreview}
        contactId={contactId}
        canReadUserIdFromUrl={canReadUserIdFromUrl}
        recaptchaSiteKey={RECAPTCHA_SITE_KEY}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
        responseCount={responseCount}
        serverPrefillData={prefillResponseData}
      />
    );
  }

  // Render interactive survey with client component for interactivity
  return (
    <SurveyClientWrapper
      survey={survey}
      workspace={workspace}
      styling={styling}
      publicDomain={publicDomain}
      responseCount={responseCount}
      languageCode={languageCode}
      isEmbed={isEmbed}
      singleUseId={singleUseId}
      singleUseResponseId={singleUseResponse?.id}
      contactId={contactId}
      canReadUserIdFromUrl={canReadUserIdFromUrl}
      recaptchaSiteKey={RECAPTCHA_SITE_KEY}
      isSpamProtectionEnabled={isSpamProtectionEnabled}
      isPreview={isPreview}
      verifiedEmail={verifiedEmail}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      TERMS_URL={TERMS_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      serverPrefillData={prefillResponseData}
    />
  );
};

/**
 * Determines which styling to use based on workspace and survey settings.
 * Returns survey styling if theme overwriting is enabled, otherwise returns workspace styling.
 */
function computeStyling(
  workspaceStyling: TWorkspaceStyling,
  surveyStyling?: TSurveyStyling | null
): TWorkspaceStyling | TSurveyStyling {
  if (!workspaceStyling.allowStyleOverwrite) {
    return workspaceStyling;
  }
  return surveyStyling?.overwriteThemeStyling ? surveyStyling : workspaceStyling;
}

/**
 * Determines the language code to use for the survey.
 * Checks URL parameter against available survey languages and returns
 * "default" if language is not found or disabled.
 */
function getLanguageCode(langParam: string | undefined, survey: TSurvey): string {
  if (!langParam) return "default";

  const selectedLanguage = survey.languages.find((surveyLanguage) => {
    return (
      surveyLanguage.language.code.toLowerCase() === langParam.toLowerCase() ||
      surveyLanguage.language.alias?.toLowerCase() === langParam.toLowerCase()
    );
  });

  if (!selectedLanguage || selectedLanguage?.default || !selectedLanguage?.enabled) {
    return "default";
  }
  return selectedLanguage.language.code;
}
