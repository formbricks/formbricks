import { TResponseData } from "@formbricks/types/v1/responses";
import { TSurveyQuestion } from "@formbricks/types/v1/surveys";
import { cn, isLight } from "../lib/utils";

type ResponseErrorComponentProps = {
  questions: TSurveyQuestion[];
  responses: TResponseData;
  brandColor: string;
  supportEmail: string | null;
};

export const ResponseErrorComponent = ({
  questions,
  responses,
  brandColor,
  supportEmail,
}: ResponseErrorComponentProps) => {
  return (
    <div className={"flex flex-col bg-white"}>
      <span className={"mb-1.5 text-base font-bold leading-6 text-slate-900"}>
        {"Your feedback is stuck :("}
      </span>
      <p className={"max-w-md text-sm font-normal leading-6 text-slate-600"}>
        Our servers are not responding.
        <br />
        Please forward your feedback via email &#128591;
      </p>
      <div className={"mt-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-5"}>
        <div className={"flex max-h-36 flex-1 flex-col space-y-1 overflow-y-scroll"}>
          {questions.map((question, index) => {
            const response = responses[question.id];
            return (
              <div className={"flex flex-col"}>
                <span className={"text-sm leading-6 text-slate-900"}>{`Question ${index + 1}`}</span>
                <span className={"-mt-1 text-sm font-semibold leading-6 text-slate-900"}>
                  {typeof response === "object" ? response.join(", ") : response}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={"mt-4 flex flex-1 flex-row items-center justify-end space-x-2"}>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(responses));
          }}
          className={cn(
            "flex items-center rounded-md border border-transparent bg-slate-200 px-3 py-3 text-base font-medium leading-4 text-black shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          )}>
          <span className="text-md">Copy your feedback</span>
        </button>
        {supportEmail && (
          <>
            <span className={"text-md font-normal"}>&</span>
            <button
              type="button"
              onClick={() => {
                window.open(`mailto:${supportEmail}`);
              }}
              className={cn(
                "flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
                isLight(brandColor) ? "text-black" : "text-white"
              )}
              style={{ backgroundColor: brandColor }}>
              <span className="text-md">Send via email</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
