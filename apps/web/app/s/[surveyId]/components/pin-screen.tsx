"use client";

import { validateSurveyPinAction } from "@/app/s/[surveyId]/actions";
import { LinkSurvey } from "@/app/s/[surveyId]/components/link-survey";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { OTPInput } from "@/modules/ui/components/otp-input";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProject } from "@formbricks/types/project";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

interface PinScreenProps {
  surveyId: string;
  project: TProject;
  emailVerificationStatus?: string;
  singleUseId?: string;
  singleUseResponse?: TResponse;
  webAppUrl: string;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  verifiedEmail?: string;
  languageCode: string;
  isEmbed: boolean;
  locale: string;
  isPreview: boolean;
}

export const PinScreen = (props: PinScreenProps) => {
  const {
    surveyId,
    project,
    webAppUrl,
    emailVerificationStatus,
    singleUseId,
    singleUseResponse,
    IMPRINT_URL,
    PRIVACY_URL,
    IS_FORMBRICKS_CLOUD,
    verifiedEmail,
    languageCode,
    isEmbed,
    locale,
    isPreview,
  } = props;

  const [localPinEntry, setLocalPinEntry] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const t = useTranslations();
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
        if (response?.data) {
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
    <LinkSurvey
      survey={survey}
      project={project}
      emailVerificationStatus={emailVerificationStatus}
      singleUseId={singleUseId}
      singleUseResponse={singleUseResponse}
      webAppUrl={webAppUrl}
      verifiedEmail={verifiedEmail}
      languageCode={languageCode}
      isEmbed={isEmbed}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      locale={locale}
      isPreview={isPreview}
    />
  );
};
