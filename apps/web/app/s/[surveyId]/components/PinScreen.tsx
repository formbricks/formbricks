"use client";

import type { NextPage } from "next";
import { TProduct } from "@formbricks/types/v1/product";
import { TResponse } from "@formbricks/types/v1/responses";
import { OTPInput } from "@formbricks/ui/OTPInput";
import { useCallback, useEffect, useState } from "react";
import { validateSurveyPin } from "@/app/s/[surveyId]/actions";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TSurveryPinValidationResponseError } from "@/app/s/[surveyId]/types";
import LinkSurvey from "@/app/s/[surveyId]/components/LinkSurvey";
import { cn } from "@formbricks/lib/cn";

interface LinkSurveyPinScreenProps {
  surveyId: string;
  product: TProduct;
  personId?: string;
  emailVerificationStatus?: string;
  prefillAnswer?: string;
  singleUseId?: string;
  singleUseResponse?: TResponse;
  webAppUrl: string;
}

const LinkSurveyPinScreen: NextPage<LinkSurveyPinScreenProps> = (props) => {
  const {
    surveyId,
    product,
    webAppUrl,
    emailVerificationStatus,
    personId,
    prefillAnswer,
    singleUseId,
    singleUseResponse,
  } = props;

  const [localPinEntry, setLocalPinEntry] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [error, setError] = useState<TSurveryPinValidationResponseError>();
  const [survey, setSurvey] = useState<TSurvey>();

  const _validateSurveyPinAsync = useCallback(async (surveyId: string, pin: number) => {
    const response = await validateSurveyPin(surveyId, pin);
    if (response.error) {
      setError(response.error);
    } else if (response.survey) {
      setSurvey(response.survey);
    }
    setLoading(false);
  }, []);

  const resetState = useCallback(() => {
    setError(undefined);
    setLoading(false);
    setLocalPinEntry("");
  }, []);

  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => resetState(), 2 * 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [error, resetState]);

  useEffect(() => {
    const validPinRegex = /^\d{4}$/;
    const isValidPin = validPinRegex.test(localPinEntry);

    const pinAsNumber = Number(localPinEntry);

    if (isValidPin) {
      // Show loading and check against the server
      setLoading(true);
      _validateSurveyPinAsync(surveyId, pinAsNumber);
      return;
    }

    setError(undefined);
    setLoading(false);
  }, [_validateSurveyPinAsync, localPinEntry, surveyId]);

  if (!survey) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="my-4 font-semibold">
            <h4>This survey is protected. Enter the PIN below</h4>
          </div>
          <OTPInput
            disabled={Boolean(error) || loading}
            value={localPinEntry}
            onChange={(value) => setLocalPinEntry(value)}
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
      product={product}
      personId={personId}
      emailVerificationStatus={emailVerificationStatus}
      prefillAnswer={prefillAnswer}
      singleUseId={singleUseId}
      singleUseResponse={singleUseResponse}
      webAppUrl={webAppUrl}
    />
  );
};

export default LinkSurveyPinScreen;
