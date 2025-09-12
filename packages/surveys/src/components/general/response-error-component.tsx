import { SubmitButton } from "@/components/buttons/submit-button";
import { processResponseData } from "@/lib/response";
import { useTranslation } from "react-i18next";
import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyQuestion } from "@formbricks/types/surveys/types";

interface ResponseErrorComponentProps {
  questions: TSurveyQuestion[];
  responseData: TResponseData;
  onRetry?: () => void;
}

export function ResponseErrorComponent({ questions, responseData, onRetry }: ResponseErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <div className="fb-flex fb-flex-col fb-bg-white fb-p-4">
      <span className="fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900">
        {t("common.your_feedback_is_stuck")}
      </span>
      <p className="fb-max-w-md fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
        {t("common.the_servers_cannot_be_reached_at_the_moment")}
        <br />
        {t("common.please_retry_now_or_try_again_later")}
      </p>
      <div className="fb-mt-4 fb-rounded-lg fb-border fb-border-slate-200 fb-bg-slate-100 fb-px-4 fb-py-5">
        <div className="fb-flex fb-max-h-36 fb-flex-1 fb-flex-col fb-space-y-3 fb-overflow-y-scroll">
          {questions.map((question, index) => {
            const response = responseData[question.id];
            if (!response) return;
            return (
              <div className="fb-flex fb-flex-col" key={`response-${index.toString()}`}>
                <span className="fb-text-sm fb-leading-6 fb-text-slate-900">{`${t("common.question")} ${(index + 1).toString()}`}</span>
                <span className="fb-mt-1 fb-text-sm fb-font-semibold fb-leading-6 fb-text-slate-900">
                  {processResponseData(response)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="fb-mt-4 fb-flex fb-flex-1 fb-flex-row fb-items-center fb-justify-end fb-space-x-2">
        <SubmitButton
          buttonLabel={t("common.retry")}
          isLastQuestion={false}
          onClick={() => {
            onRetry?.();
          }}
        />
      </div>
    </div>
  );
}
