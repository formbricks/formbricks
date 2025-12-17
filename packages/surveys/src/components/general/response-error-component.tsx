import { useTranslation } from "react-i18next";
import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { SubmitButton } from "@/components/buttons/submit-button";
import { processResponseData } from "@/lib/response";

interface ResponseErrorComponentProps {
  questions: TSurveyElement[];
  responseData: TResponseData;
  onRetry?: () => void;
}

export function ResponseErrorComponent({ questions, responseData, onRetry }: ResponseErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col bg-white p-4">
      <span className="mb-1.5 text-base leading-6 font-bold text-slate-900">
        {t("common.your_feedback_is_stuck")}
      </span>
      <p className="max-w-md text-sm leading-6 font-normal text-slate-600">
        {t("common.the_servers_cannot_be_reached_at_the_moment")}
        <br />
        {t("common.please_retry_now_or_try_again_later")}
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-5">
        <div className="flex max-h-36 flex-1 flex-col space-y-3 overflow-y-scroll">
          {questions.map((question, index) => {
            const response = responseData[question.id];
            if (!response) return;
            return (
              <div className="flex flex-col" key={`response-${index.toString()}`}>
                <span className="text-sm leading-6 text-slate-900">{`${t("common.question")} ${(index + 1).toString()}`}</span>
                <span className="mt-1 text-sm leading-6 font-semibold text-slate-900">
                  {processResponseData(response)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-row items-center justify-end space-x-2">
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
