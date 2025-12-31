"use client";

import { Project } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TProjectStyling } from "@formbricks/types/project";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { LinkSurveyWrapper } from "@/modules/survey/link/components/link-survey-wrapper";
import { getPrefillValue } from "@/modules/survey/link/lib/prefill";
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

let setBlockId = (_: string) => {};
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

  const handleResetSurvey = () => {
    if (survey.welcomeCard.enabled) {
      setBlockId("start");
    } else if (survey.blocks[0]) {
      setBlockId(survey.blocks[0].id);
    }
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
        recaptchaSiteKey={recaptchaSiteKey}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
      />
    </LinkSurveyWrapper>
  );
};
