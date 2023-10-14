"use client";

import type { NextPage } from "next";
import { TProduct } from "@/../../packages/types/v1/product";
import { TResponse } from "@/../../packages/types/v1/responses";
import OtpInput from "react-otp-input";
import { useCallback, useEffect, useState } from "react";
import { validateSurveyPin } from "@/app/s/[surveyId]/actions";
import { TSurvey } from "@/../../packages/types/v1/surveys";
import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import { ISurveryPinValidationResponseError } from "@/app/s/[surveyId]/types";

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

  const [error, setError] = useState<ISurveryPinValidationResponseError>();
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
          <OtpInput
            isDisabled={loading}
            hasErrored={Boolean(!!error)}
            value={localPinEntry}
            onChange={(value) => setLocalPinEntry(value)}
            numInputs={4}
            separator={<span style={{ width: "8px" }}></span>}
            isInputNum={true}
            shouldAutoFocus={true}
            inputStyle={{
              border: "1px solid #CFD3DB",
              borderRadius: "8px",
              width: "64px",
              height: "84px",
              fontSize: "24px",
              color: "#000",
              fontWeight: "400",
              caretColor: "blue",
            }}
            errorStyle={{
              border: "1px solid red",
            }}
            focusStyle={{
              border: "1px solid #CFD3DB",
              outline: "none",
            }}
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
