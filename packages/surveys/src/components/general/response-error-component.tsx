import { useTranslation } from "react-i18next";
import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { SubmitButton } from "@/components/buttons/submit-button";
import { processResponseData } from "@/lib/response";

interface ResponseErrorComponentProps {
  readonly questions: TSurveyElement[];
  readonly responseData: TResponseData;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
}

export function ResponseErrorComponent({
  questions,
  responseData,
  onRetry,
  isRetrying = false,
}: ResponseErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-survey-bg text-heading flex flex-col p-4">
      <span className="mb-1.5 text-base leading-6 font-bold">{t("common.your_feedback_is_stuck")}</span>
      <p className="max-w-md text-sm leading-6 font-normal">
        {t("common.the_servers_cannot_be_reached_at_the_moment")}
        <br />
        {t("common.please_retry_now_or_try_again_later")}
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-5">
        <div className="flex max-h-48 flex-1 flex-col space-y-2 overflow-y-scroll">
          {questions.map((question, index) => {
            const response = responseData[question.id];
            if (!response) return;
            return (
              <div className="flex flex-col" key={`response-${index.toString()}`}>
                <span className="text-sm leading-5 text-slate-900">{`${t("common.question")} ${(index + 1).toString()}`}</span>
                <span className="text-sm leading-5 font-semibold text-slate-900">
                  {processResponseData(response)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-row items-center justify-end space-x-2">
        <SubmitButton
          buttonLabel={isRetrying ? t("common.retrying") : t("common.retry")}
          isLastQuestion={false}
          onClick={() => {
            if (!isRetrying) {
              onRetry?.();
            }
          }}
          disabled={isRetrying}
        />
      </div>
    </div>
  );
}
