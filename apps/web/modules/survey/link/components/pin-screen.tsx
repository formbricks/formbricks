"use client";

import { Project, Response } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { validateSurveyPinAction } from "@/modules/survey/link/actions";
import { SurveyClientWrapper } from "@/modules/survey/link/components/survey-client-wrapper";
import { OTPInput } from "@/modules/ui/components/otp-input";

interface PinScreenProps {
  surveyId: string;
  project: Pick<Project, "styling" | "logo" | "linkSurveyBranding">;
  singleUseId?: string;
  singleUseResponse?: Pick<Response, "id" | "finished">;
  publicDomain: string;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  verifiedEmail?: string;
  languageCode: string;
  isEmbed: boolean;
  isPreview: boolean;
  contactId?: string;
  recaptchaSiteKey?: string;
  isSpamProtectionEnabled?: boolean;
  responseCount?: number;
  styling: TProjectStyling | TSurveyStyling;
}

export const PinScreen = (props: PinScreenProps) => {
  const {
    surveyId,
    project,
    publicDomain,
    singleUseId,
    singleUseResponse,
    IMPRINT_URL,
    PRIVACY_URL,
    IS_FORMBRICKS_CLOUD,
    verifiedEmail,
    languageCode,
    isEmbed,
    isPreview,
    contactId,
    recaptchaSiteKey,
    isSpamProtectionEnabled = false,
    responseCount,
    styling,
  } = props;

  const [localPinEntry, setLocalPinEntry] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [survey, setSurvey] = useState<TSurvey>();

  const resetState = useCallback(() => {
    setError("");
    setLoading(false);
    setLocalPinEntry("");
  }, []);

  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        resetState();
      }, 2 * 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [error, resetState]);

  useEffect(() => {
    const validateSurveyPin = async () => {
      const validPinRegex = /^\d{4}$/;
      const isValidPin = validPinRegex.test(localPinEntry);
      if (isValidPin) {
        setLoading(true);
        const response = await validateSurveyPinAction({ surveyId, pin: localPinEntry });
        if (response?.data?.survey) {
          setSurvey(response.data.survey);
        } else {
          const errorMessage = getFormattedErrorMessage(response);
          setError(errorMessage);
        }
        setLoading(false);
      }
    };

    void validateSurveyPin();
  }, [localPinEntry, surveyId]);

  if (!survey) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="my-4 font-semibold">
            <h4>{t("s.enter_pin")}</h4>
          </div>
          <OTPInput
            disabled={Boolean(error) || loading}
            value={localPinEntry}
            onChange={(value) => {
              setLocalPinEntry(value);
            }}
            valueLength={4}
            inputBoxClassName={cn({ "border-red-400": Boolean(error) })}
          />
        </div>
      </div>
    );
  }

  return (
    <SurveyClientWrapper
      survey={survey}
      project={project}
      styling={styling}
      publicDomain={publicDomain}
      responseCount={responseCount}
      languageCode={languageCode}
      isEmbed={isEmbed}
      singleUseId={singleUseId}
      singleUseResponseId={singleUseResponse?.id}
      contactId={contactId}
      recaptchaSiteKey={recaptchaSiteKey}
      isSpamProtectionEnabled={isSpamProtectionEnabled}
      isPreview={isPreview}
      verifiedEmail={verifiedEmail}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
    />
  );
};
