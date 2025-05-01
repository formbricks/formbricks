"use client";

import { SingleResponseCardBody } from "@/modules/analysis/components/SingleResponseCard/components/SingleResponseCardBody";
import { isValidValue } from "@/modules/analysis/components/SingleResponseCard/util";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { ExternalLink } from "lucide-react";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { formatAddress } from "@formbricks/web3";

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

  const verifiedBadge = (
    <svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M29.9 33.4L27 30.55C26.6333 30.1833 26.1753 30 25.626 30C25.0767 30 24.6013 30.2 24.2 30.6C23.8333 30.9667 23.65 31.4333 23.65 32C23.65 32.5667 23.8333 33.0333 24.2 33.4L28.5 37.7C28.9 38.1 29.3667 38.3 29.9 38.3C30.4333 38.3 30.9 38.1 31.3 37.7L39.8 29.2C40.2 28.8 40.3913 28.3333 40.374 27.8C40.3567 27.2667 40.1653 26.8 39.8 26.4C39.4 26 38.9253 25.792 38.376 25.776C37.8267 25.76 37.3513 25.9513 36.95 26.35L29.9 33.4ZM24.3 51.5L21.4 46.6L15.9 45.4C15.4 45.3 15 45.042 14.7 44.626C14.4 44.21 14.2833 43.7513 14.35 43.25L14.9 37.6L11.15 33.3C10.8167 32.9333 10.65 32.5 10.65 32C10.65 31.5 10.8167 31.0667 11.15 30.7L14.9 26.4L14.35 20.75C14.2833 20.25 14.4 19.7913 14.7 19.374C15 18.9567 15.4 18.6987 15.9 18.6L21.4 17.4L24.3 12.5C24.5667 12.0667 24.9333 11.7747 25.4 11.624C25.8667 11.4733 26.3333 11.4987 26.8 11.7L32 13.9L37.2 11.7C37.6667 11.5 38.1333 11.4747 38.6 11.624C39.0667 11.7733 39.4333 12.0653 39.7 12.5L42.6 17.4L48.1 18.6C48.6 18.7 49 18.9587 49.3 19.376C49.6 19.7933 49.7167 20.2513 49.65 20.75L49.1 26.4L52.85 30.7C53.1833 31.0667 53.35 31.5 53.35 32C53.35 32.5 53.1833 32.9333 52.85 33.3L49.1 37.6L49.65 43.25C49.7167 43.75 49.6 44.2087 49.3 44.626C49 45.0433 48.6 45.3013 48.1 45.4L42.6 46.6L39.7 51.5C39.4333 51.9333 39.0667 52.2253 38.6 52.376C38.1333 52.5267 37.6667 52.5013 37.2 52.3L32 50.1L26.8 52.3C26.3333 52.5 25.8667 52.5253 25.4 52.376C24.9333 52.2267 24.5667 51.9347 24.3 51.5Z"
        fill="#38B5DB"
      />
    </svg>
  );

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
                <div className="flex items-center gap-1.5 py-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="">{verifiedBadge}</span>
                    <span className="font-medium">{t("environments.activity.card.verified_hash")}</span>
                  </div>
                  <TooltipRenderer
                    tooltipContent={
                      <span className="text-xs">
                        t{"environments.activity.card.this_address_is_immutable_because_its_on_chain"}
                      </span>
                    }>
                    <span className="text-blue-500">{formatAddress(transactionHash.toString(), 27)}</span>
                  </TooltipRenderer>

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
