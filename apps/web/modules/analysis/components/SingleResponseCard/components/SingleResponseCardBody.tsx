"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { parseRecallInfo } from "@/lib/utils/recall";
import { ResponseCardQuotas } from "@/modules/ee/quotas/components/single-response-card-quotas";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { isValidValue } from "../util";
import { ElementSkip } from "./ElementSkip";
import { HiddenFields } from "./HiddenFields";
import { RenderResponse } from "./RenderResponse";
import { ResponseVariables } from "./ResponseVariables";
import { VerifiedEmail } from "./VerifiedEmail";

interface SingleResponseCardBodyProps {
  survey: TSurvey;
  response: TResponseWithQuotas;
  skippedQuestions: string[][];
}

export const SingleResponseCardBody = ({
  survey,
  response,
  skippedQuestions,
}: SingleResponseCardBodyProps) => {
  const elements = getElementsFromBlocks(survey.blocks);
  const isFirstElementAnswered = elements[0] ? !!response.data[elements[0].id] : false;
  const { t } = useTranslation();
  const formatTextWithSlashes = (text: string) => {
    // Updated regex to match content between #/ and \#
    const regex = /#\/(.*?)\\#/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      // Check if the part was inside #/ and \#
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            className="ml-0.5 mr-0.5 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-sm first:ml-0">
            @{part}
          </span>
        );
      } else {
        return part;
      }
    });
  };

  return (
    <div className="p-6">
      {survey.welcomeCard.enabled && (
        <ElementSkip
          skippedElements={[]}
          elements={elements}
          status={"welcomeCard"}
          isFirstElementAnswered={isFirstElementAnswered}
          responseData={response.data}
        />
      )}
      <div className="space-y-6">
        {survey.isVerifyEmailEnabled && response.data["verifiedEmail"] && (
          <VerifiedEmail responseData={response.data} />
        )}
        {elements.map((question) => {
          const skipped = skippedQuestions.find((skippedQuestionElement) =>
            skippedQuestionElement.includes(question.id)
          );

          // If found, remove it from the list
          if (skipped) {
            skippedQuestions = skippedQuestions.filter((item) => item !== skipped);
          }

          return (
            <div key={`${question.id}`}>
              {isValidValue(response.data[question.id]) ? (
                <div>
                  <p className="mb-1 text-sm font-semibold text-slate-600">
                    {formatTextWithSlashes(
                      getTextContent(
                        parseRecallInfo(
                          getLocalizedValue(question.headline, "default"),
                          response.data,
                          response.variables,
                          true
                        )
                      )
                    )}
                  </p>
                  <div dir="auto">
                    <RenderResponse
                      element={question}
                      survey={survey}
                      responseData={response.data[question.id]}
                      language={response.language}
                      showId={true}
                    />
                  </div>
                </div>
              ) : (
                <ElementSkip
                  skippedElements={skipped}
                  elements={elements}
                  responseData={response.data}
                  status={
                    response.finished ||
                    (skippedQuestions.length > 0 &&
                      !skippedQuestions[skippedQuestions.length - 1].includes(question.id))
                      ? "skipped"
                      : "aborted"
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      {survey.variables.length > 0 && (
        <ResponseVariables variables={survey.variables} variablesData={response.variables} />
      )}
      {survey.hiddenFields.fieldIds && (
        <HiddenFields hiddenFields={survey.hiddenFields} responseData={response.data} />
      )}

      <ResponseCardQuotas quotas={response.quotas} />

      {response.finished && (
        <div className="mt-4 flex items-center">
          <CheckCircle2Icon className="h-6 w-6 text-slate-400" />
          <p className="mx-2 rounded-lg bg-slate-100 px-2 text-sm font-medium text-slate-700">
            {t("common.completed")}
          </p>
        </div>
      )}
    </div>
  );
};
