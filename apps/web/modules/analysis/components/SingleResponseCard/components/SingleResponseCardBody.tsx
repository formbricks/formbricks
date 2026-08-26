"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { buildServerEmbeddedValues } from "@/lib/surveyLogic/utils";
import { getSurveyDateFormatMap } from "@/lib/utils/date-display";
import { parseRecallInfo } from "@/lib/utils/recall";
import { ResponseCardQuotas } from "@/modules/ee/quotas/components/single-response-card-quotas";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { isValidValue } from "../util";
import { AutoCapturedFields } from "./AutoCapturedFields";
import { ElementSkip } from "./ElementSkip";
import { HiddenFields } from "./HiddenFields";
import { RenderResponse } from "./RenderResponse";
import { ResponseVariables } from "./ResponseVariables";
import { VerifiedEmail } from "./VerifiedEmail";

interface SingleResponseCardBodyProps {
  survey: TSurvey;
  response: TResponseWithQuotas;
  skippedQuestions: string[][];
  locale: TUserLocale;
}

export const SingleResponseCardBody = ({
  survey,
  response,
  skippedQuestions,
  locale,
}: Readonly<SingleResponseCardBodyProps>) => {
  const elements = getElementsFromBlocks(survey.blocks);
  // ENG-1837: both blocks below render the survey's Embedded Data definitions, resolved through the
  // tables with the legacy columns as fallback.
  const computedFields = getComputedEmbeddedFields(survey);
  const ingestedFields = getIngestedEmbeddedFields(survey);
  const dateFormats = getSurveyDateFormatMap(elements);
  // ENG-2538: recall's lookup map, not `response.data` — a reserved token such as `#recall:country#`
  // rendered its fallback on this card while resolving correctly in the live survey. Shared with
  // `ElementSkip`, which recalls the same headlines for skipped elements.
  const recallValues = buildServerEmbeddedValues(response, survey);
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
            className="mr-0.5 ml-0.5 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-sm first:ml-0">
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
          recallValues={recallValues}
          variables={response.variables}
          locale={locale}
        />
      )}
      <div className="space-y-6">
        {survey.isVerifyEmailEnabled && response.data["verifiedEmail"] && (
          <VerifiedEmail responseData={response.data} />
        )}
        {elements.map((question) => {
          // Skip CTA elements without external buttons only if they have no response data
          // This preserves historical data from when buttonExternal was true
          if (
            question.type === TSurveyElementTypeEnum.CTA &&
            !question.buttonExternal &&
            !response.data[question.id]
          ) {
            return null;
          }

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
                          recallValues,
                          response.variables,
                          true,
                          locale,
                          dateFormats
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
                      locale={locale}
                      showId={true}
                    />
                  </div>
                </div>
              ) : (
                <ElementSkip
                  skippedElements={skipped}
                  elements={elements}
                  recallValues={recallValues}
                  variables={response.variables}
                  locale={locale}
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
      {computedFields.length > 0 && (
        <ResponseVariables variables={computedFields} variablesData={response.variables} />
      )}
      {ingestedFields.length > 0 && (
        <HiddenFields hiddenFields={ingestedFields} responseData={response.data} />
      )}
      {/* After the survey's own declared fields: what the author defined, then what was captured for
          free. A declared field and a same-named reserved one both appear, deliberately — the author
          needs to see both, where recall and logic have to pick one. */}
      <AutoCapturedFields response={response} />

      <ResponseCardQuotas quotas={response.quotas} />

      {response.finished && (
        <div className="mt-4 flex items-center">
          <CheckCircle2Icon className="size-6 text-slate-400" />
          <p className="mx-2 rounded-lg bg-slate-100 px-2 text-sm font-medium text-slate-700">
            {t("common.completed")}
          </p>
        </div>
      )}
    </div>
  );
};
