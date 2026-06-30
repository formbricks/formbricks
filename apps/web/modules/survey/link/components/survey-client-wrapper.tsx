"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { CustomScriptsInjector } from "@/modules/survey/link/components/custom-scripts-injector";
import { LinkSurveyWrapper } from "@/modules/survey/link/components/link-survey-wrapper";
import { OfflineAlert } from "@/modules/survey/link/components/offline-alert";
import { getPrefillValue } from "@/modules/survey/link/lib/prefill";
import { getUserIdFromSearchParams } from "@/modules/survey/link/lib/user-id";
import { getWebAppLocale, isRTLLanguage } from "@/modules/survey/link/lib/utils";
import { SurveyInline } from "@/modules/ui/components/survey";

interface SurveyClientWrapperProps {
  survey: TSurvey;
  workspace: Pick<Workspace, "styling" | "logo" | "linkSurveyBranding" | "customHeadScripts">;
  styling: TWorkspaceStyling | TSurveyStyling;
  publicDomain: string;
  responseCount?: number;
  languageCode: string;
  isEmbed: boolean;
  singleUseId?: string;
  singleUseResponseId?: string;
  contactId?: string;
  canReadUserIdFromUrl?: boolean;
  recaptchaSiteKey?: string;
  isSpamProtectionEnabled: boolean;
  isPreview: boolean;
  verifiedEmail?: string;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  TERMS_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
}

let setBlockId = (_: string) => {};
let setResponseData = (_: TResponseData) => {};

export const SurveyClientWrapper = ({
  survey,
  workspace,
  styling,
  publicDomain,
  responseCount,
  languageCode,
  isEmbed,
  singleUseId,
  singleUseResponseId,
  contactId,
  canReadUserIdFromUrl = false,
  recaptchaSiteKey,
  isSpamProtectionEnabled,
  isPreview,
  verifiedEmail,
  IMPRINT_URL,
  PRIVACY_URL,
  TERMS_URL,
  IS_FORMBRICKS_CLOUD,
}: SurveyClientWrapperProps) => {
  const searchParams = useSearchParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    const webAppLocale = getWebAppLocale(languageCode, survey);
    if (i18n.language !== webAppLocale) {
      i18n.changeLanguage(webAppLocale).catch(() => {
        i18n.changeLanguage("en-US");
      });
    }
  }, [languageCode, survey, i18n]);

  const skipPrefilled = searchParams.get("skipPrefilled") === "true";
  const offlineSupport = searchParams.get("offlineSupport") === "true";
  const userId = canReadUserIdFromUrl ? getUserIdFromSearchParams(searchParams) : undefined;
  const elements = useMemo(() => getElementsFromBlocks(survey.blocks), [survey.blocks]);

  const startAt = searchParams.get("startAt");

  // Extract survey properties outside useMemo to create stable references
  const welcomeCardEnabled = survey.welcomeCard.enabled;

  // Validate startAt parameter against survey elements
  const isStartAtValid = useMemo(() => {
    if (!startAt) return false;
    if (welcomeCardEnabled && startAt === "start") return true;

    const isValid = elements.some((element) => element.id === startAt);

    // Clean up invalid startAt from URL to prevent confusion
    if (!isValid && globalThis.window !== undefined) {
      const url = new URL(globalThis.location.href);
      url.searchParams.delete("startAt");
      globalThis.history.replaceState({}, "", url.toString());
    }

    return isValid;
  }, [welcomeCardEnabled, elements, startAt]);

  const prefillValue = getPrefillValue(survey, searchParams, languageCode);
  const [autoFocus, setAutoFocus] = useState(false);

  // Enable autofocus only when not in iframe
  useEffect(() => {
    if (globalThis.self === globalThis.top) {
      setAutoFocus(true);
    }
  }, []);

  // Extract hidden fields from URL parameters
  const hiddenFieldsRecord = useMemo(() => {
    const fieldsRecord: Record<string, string> = {};
    for (const field of survey.hiddenFields.fieldIds || []) {
      const answer = searchParams.get(field);
      if (answer) fieldsRecord[field] = answer;
    }
    return fieldsRecord;
  }, [searchParams, JSON.stringify(survey.hiddenFields.fieldIds || [])]);

  // Include verified email in hidden fields if available
  const getVerifiedEmail = useMemo<Record<string, string> | null>(() => {
    if (survey.isVerifyEmailEnabled && verifiedEmail) {
      return { verifiedEmail: verifiedEmail };
    }
    return null;
  }, [survey.isVerifyEmailEnabled, verifiedEmail]);

  const [offlineStatus, setOfflineStatus] = useState({
    isOnline: true,
    isSyncing: false,
    pendingSyncCount: 0,
  });
  const handleOfflineStatusChange = useCallback(
    (status: { isOnline: boolean; isSyncing: boolean; pendingSyncCount: number }) => {
      setOfflineStatus(status);
    },
    []
  );

  const handleResetSurvey = () => {
    if (survey.welcomeCard.enabled) {
      setBlockId("start");
    } else if (survey.blocks[0]) {
      setBlockId(survey.blocks[0].id);
    }
    setResponseData({});
  };
  const jsSurvey = useMemo(() => toJsWorkspaceStateSurvey(survey), [survey]);
  const isCardless = styling.cardArrangement?.linkSurveys === "cardless";
  const hasLogo = !styling.isLogoHidden && !!(styling.logo?.url || workspace.logo?.url);

  // Determine text direction based on language code for logo positioning only
  // which checks both language code and survey content. This is only for logo UI positioning.
  const logoDir = useMemo(() => {
    return isRTLLanguage(jsSurvey, languageCode) ? "rtl" : "auto";
  }, [languageCode, jsSurvey]);

  return (
    <>
      {/* Inject custom scripts for tracking/analytics (self-hosted only) */}
      {!IS_FORMBRICKS_CLOUD && !isPreview && (
        <CustomScriptsInjector
          workspaceScripts={workspace.customHeadScripts}
          surveyScripts={survey.customHeadScripts}
          scriptsMode={survey.customHeadScriptsMode}
        />
      )}
      <LinkSurveyWrapper
        workspace={workspace}
        workspaceId={survey.workspaceId}
        surveyId={survey.id}
        isWelcomeCardEnabled={survey.welcomeCard.enabled}
        isPreview={isPreview}
        surveyType={survey.type}
        determineStyling={() => styling}
        handleResetSurvey={handleResetSurvey}
        isEmbed={isEmbed}
        publicDomain={publicDomain}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        TERMS_URL={TERMS_URL}
        isBrandingEnabled={workspace.linkSurveyBranding}
        dir={logoDir}>
        <SurveyInline
          appUrl={publicDomain}
          workspaceId={survey.workspaceId}
          isPreviewMode={isPreview}
          survey={jsSurvey}
          styling={styling}
          languageCode={languageCode}
          isBrandingEnabled={workspace.linkSurveyBranding}
          shouldResetQuestionId={false}
          autoFocus={autoFocus}
          prefillResponseData={prefillValue}
          skipPrefilled={skipPrefilled}
          responseCount={responseCount}
          getSetBlockId={(f: (value: string) => void) => {
            setBlockId = f;
          }}
          getSetResponseData={(f: (value: TResponseData) => void) => {
            setResponseData = f;
          }}
          startAtQuestionId={startAt && isStartAtValid ? startAt : undefined}
          fullSizeCards={isEmbed}
          hiddenFieldsRecord={{
            ...hiddenFieldsRecord,
            ...getVerifiedEmail,
          }}
          singleUseId={singleUseId}
          singleUseResponseId={singleUseResponseId}
          getSetIsResponseSendingFinished={(_f: (value: boolean) => void) => {}}
          contactId={contactId}
          userId={userId}
          recaptchaSiteKey={recaptchaSiteKey}
          isSpamProtectionEnabled={isSpamProtectionEnabled}
          offlineSupport={offlineSupport}
          onOfflineStatusChange={offlineSupport ? handleOfflineStatusChange : undefined}
          showCardlessPreviewLogoSlot={isCardless && hasLogo}
        />
      </LinkSurveyWrapper>
      {offlineSupport && !isEmbed && (
        <OfflineAlert
          isOnline={offlineStatus.isOnline}
          isSyncing={offlineStatus.isSyncing}
          pendingSyncCount={offlineStatus.pendingSyncCount}
        />
      )}
    </>
  );
};
