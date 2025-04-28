"use client";

import { SingleResponseCardBody } from "@/modules/analysis/components/SingleResponseCard/components/SingleResponseCardBody";
import { isValidValue } from "@/modules/analysis/components/SingleResponseCard/util";
import { useTranslate } from "@tolgee/react";
import { ExternalLink } from "lucide-react";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SingleResponseCardProps {
  survey: TSurvey;
  response: TResponse;
}

export const SingleResponseCard = ({ survey, response }: SingleResponseCardProps) => {
  const { t } = useTranslate();

  let skippedQuestions: string[][] = [];
  let temp: string[] = [];

  const transactionHash = response.data.transactionHash;
  const transactionUrl = transactionHash
    ? `https://zksync-sepolia.blockscout.com/tx/${transactionHash}`
    : null;

  if (response.finished) {
    survey.questions.forEach((question) => {
      if (!isValidValue(response.data[question.id])) {
        temp.push(question.id);
      } else {
        if (temp.length > 0) {
          skippedQuestions.push([...temp]);
          temp = [];
        }
      }
    });
  } else {
    for (let index = survey.questions.length - 1; index >= 0; index--) {
      const question = survey.questions[index];
      if (!response.data[question.id]) {
        if (skippedQuestions.length === 0) {
          temp.push(question.id);
        } else if (skippedQuestions.length > 0 && !isValidValue(response.data[question.id])) {
          temp.push(question.id);
        }
      } else {
        if (temp.length > 0) {
          temp.reverse();
          skippedQuestions.push([...temp]);
          temp = [];
        }
      }
    }
  }
  // Handle the case where the last entries are empty
  if (temp.length > 0) {
    skippedQuestions.push(temp);
  }

  return (
    <div>
      <div>
        {transactionHash && (
          <div className="mb-4 rounded-md bg-slate-50 p-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-700">
                  {t("environments.activity.card.response_info")}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium">{t("environments.activity.card.hash")}</span>
                  <span className="">{transactionHash.toString()}</span>
                  <a
                    href={transactionUrl || "#"}
                    target="_blank"
                    className="ml-1 inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    <span className="ml-1">{t("environments.activity.card.view")}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div>
        <SingleResponseCardBody survey={survey} response={response} skippedQuestions={skippedQuestions} />
      </div>
    </div>
  );
};
