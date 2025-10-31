"use client";

import { Project } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TProjectStyling } from "@formbricks/types/project";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { LinkSurveyWrapper } from "@/modules/survey/link/components/link-survey-wrapper";
import { getPrefillValue } from "@/modules/survey/link/lib/utils";
import { SurveyInline } from "@/modules/ui/components/survey";

interface SurveyClientWrapperProps {
  survey: TSurvey;
  project: Pick<Project, "styling" | "logo" | "linkSurveyBranding">;
  styling: TProjectStyling | TSurveyStyling;
  publicDomain: string;
  responseCount?: number;
  languageCode: string;
  isEmbed: boolean;
  singleUseId?: string;
  singleUseResponseId?: string;
  contactId?: string;
  recaptchaSiteKey?: string;
  isSpamProtectionEnabled: boolean;
  isPreview: boolean;
  verifiedEmail?: string;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
}

// Module-level functions to allow SurveyInline to control survey state
let setQuestionId = (_: string) => {};
let setResponseData = (_: TResponseData) => {};

export const SurveyClientWrapper = ({
  survey,
  project,
  styling,
  publicDomain,
  responseCount,
  languageCode,
  isEmbed,
  singleUseId,
  singleUseResponseId,
  contactId,
  recaptchaSiteKey,
  isSpamProtectionEnabled,
  isPreview,
  verifiedEmail,
  IMPRINT_URL,
  PRIVACY_URL,
  IS_FORMBRICKS_CLOUD,
}: SurveyClientWrapperProps) => {
  const searchParams = useSearchParams();
  const skipPrefilled = searchParams.get("skipPrefilled") === "true";
  const startAt = searchParams.get("startAt");

  // Validate startAt parameter against survey questions
  const isStartAtValid = useMemo(() => {
    if (!startAt) return false;
    if (survey.welcomeCard.enabled && startAt === "start") return true;
    const isValid = survey.questions.some((q) => q.id === startAt);

    // Clean up invalid startAt from URL to prevent confusion
    if (!isValid && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("startAt");
      window.history.replaceState({}, "", url.toString());
    }

    return isValid;
  }, [survey, startAt]);

  const prefillValue = getPrefillValue(survey, searchParams, languageCode);
  const [autoFocus, setAutoFocus] = useState(false);

  // Enable autofocus only when not in iframe
  useEffect(() => {
    if (window.self === window.top) {
      setAutoFocus(true);
    }
  }, []);

  // Extract hidden fields from URL parameters
  const hiddenFieldsRecord = useMemo(() => {
    const fieldsRecord: Record<string, string> = {};
    survey.hiddenFields.fieldIds?.forEach((field) => {
      const answer = searchParams.get(field);
      if (answer) fieldsRecord[field] = answer;
    });
    return fieldsRecord;
  }, [searchParams, survey.hiddenFields.fieldIds]);

  // Include verified email in hidden fields if available
  const getVerifiedEmail = useMemo<Record<string, string> | null>(() => {
    if (survey.isVerifyEmailEnabled && verifiedEmail) {
      return { verifiedEmail: verifiedEmail };
    }
    return null;
  }, [survey.isVerifyEmailEnabled, verifiedEmail]);

  const handleResetSurvey = () => {
    setQuestionId(survey.welcomeCard.enabled ? "start" : survey.questions[0].id);
    setResponseData({});
  };

  return (
    <LinkSurveyWrapper
      project={project}
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
      isBrandingEnabled={project.linkSurveyBranding}>
      <SurveyInline
        appUrl={publicDomain}
        environmentId={survey.environmentId}
        isPreviewMode={isPreview}
        survey={survey}
        styling={styling}
        languageCode={languageCode}
        isBrandingEnabled={project.linkSurveyBranding}
        shouldResetQuestionId={false}
        autoFocus={autoFocus}
        prefillResponseData={prefillValue}
        skipPrefilled={skipPrefilled}
        responseCount={responseCount}
        getSetQuestionId={(f: (value: string) => void) => {
          setQuestionId = f;
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
        recaptchaSiteKey={recaptchaSiteKey}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
      />
    </LinkSurveyWrapper>
  );
};
