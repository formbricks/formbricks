import { Input } from "@/modules/ui/components/input";

interface SurveyLinkDisplayProps {
  surveyUrl: string;
}

export const SurveyLinkDisplay = ({ surveyUrl }: SurveyLinkDisplayProps) => {
  return (
    <>
      {surveyUrl ? (
        <Input
          data-testid="survey-url-input"
          autoFocus={true}
          className="h-9 w-full min-w-96 text-ellipsis rounded-lg border bg-white px-3 py-1 text-slate-800 caret-transparent"
          value={surveyUrl}
          readOnly
        />
      ) : (
        //loading state
        <div
          data-testid="loading-div"
          className="h-9 w-full min-w-96 animate-pulse rounded-lg bg-slate-100 px-3 py-1 text-slate-800 caret-transparent"
        />
      )}
    </>
  );
};
