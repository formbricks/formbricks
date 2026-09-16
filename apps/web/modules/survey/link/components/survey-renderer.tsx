import { notFound } from "next/navigation";
import { type Response } from "@formbricks/database/prisma-browser";
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
import { resolveSurveyLanguageCode } from "@/modules/survey/link/lib/language";
import type { TLinkSurveySearchParams } from "@/modules/survey/link/lib/types";
import { hasUserIdSearchParam } from "@/modules/survey/link/lib/user-id";
import { getGateLocale } from "@/modules/survey/link/lib/utils";
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
}: SurveyRendererProps) => {
  const langParam = searchParams.lang;
  const isEmbed = searchParams.embed === "true";

  // The survey's content language, and the locale everything around that content is translated in.
  // Both are resolved once, here, so a gate screen can never disagree with the survey behind it.
  const languageCode = resolveSurveyLanguageCode(langParam, survey);
  const gateLocale = getGateLocale({ langParam, languageCode, survey, fallbackLocale: locale });

  // Archived surveys are absent from the workspace for respondents — treat the public link as a
  // missing survey (same as a draft or non-link survey) rather than showing an inactive/scheduled state.
  if (survey.status === "draft" || survey.type !== "link" || survey.archivedAt) {
    notFound();
  }

  // Extract workspace from pre-fetched context
  const { workspace } = workspaceContext;

  // Every prop passed to a client component is serialized into the RSC payload and readable in the
  // page source, so the survey handed to them must never carry the PIN — the pin gate itself stays
  // server-side (see the `survey.pin` branch below and `validateSurveyPinAction`).
  const publicSurvey: TSurvey = { ...survey, pin: null };

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
          survey={publicSurvey}
          isErrorComponent={true}
          languageCode={languageCode}
          styling={workspace.styling}
          locale={gateLocale}
        />
      );
    }
    return (
      <VerifyEmail
        singleUseId={searchParams.suId ?? ""}
        singleUseToken={searchParams.suToken}
        survey={publicSurvey}
        languageCode={languageCode}
        styling={workspace.styling}
        locale={gateLocale}
      />
    );
  }

  // Compute final styling based on workspace and survey settings
  const styling = computeStyling(workspace.styling, survey.styling);
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
        locale={gateLocale}
        isEmbed={isEmbed}
        isPreview={isPreview}
        contactId={contactId}
        canReadUserIdFromUrl={canReadUserIdFromUrl}
        recaptchaSiteKey={RECAPTCHA_SITE_KEY}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
        responseCount={responseCount}
      />
    );
  }

  // Render interactive survey with client component for interactivity
  return (
    <SurveyClientWrapper
      survey={publicSurvey}
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
