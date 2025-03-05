import { SubmitButton } from "@/components/buttons/submit-button";
import { processResponseData } from "@/lib/response";
import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyQuestion } from "@formbricks/types/surveys/types";

interface ResponseErrorComponentProps {
  questions: TSurveyQuestion[];
  responseData: TResponseData;
  onRetry?: () => void;
}

export function ResponseErrorComponent({ questions, responseData, onRetry }: ResponseErrorComponentProps) {
  return (
    <div className="fb-flex fb-flex-col fb-bg-white fb-p-4">
      <span className="fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900">
        Your feedback is stuck :(
      </span>
      <p className="fb-max-w-md fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600">
        The servers cannot be reached at the moment.
        <br />
        Please retry now or try again later.
      </p>
      <div className="fb-mt-4 fb-rounded-lg fb-border fb-border-slate-200 fb-bg-slate-100 fb-px-4 fb-py-5">
        <div className="fb-flex fb-max-h-36 fb-flex-1 fb-flex-col fb-space-y-3 fb-overflow-y-scroll">
          {questions.map((question, index) => {
            const response = responseData[question.id];
            if (!response) return;
            return (
              <div className="fb-flex fb-flex-col" key={`response-${index.toString()}`}>
                <span className="fb-text-sm fb-leading-6 fb-text-slate-900">{`Question ${(index + 1).toString()}`}</span>
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
          tabIndex={2}
          buttonLabel="Retry"
          isLastQuestion={false}
          onClick={() => {
            onRetry?.();
          }}
        />
      </div>
    </div>
  );
}
