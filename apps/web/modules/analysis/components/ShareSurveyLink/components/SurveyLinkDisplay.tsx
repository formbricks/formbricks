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
          className="mt-2 w-full min-w-96 rounded-lg border bg-white px-4 py-2 text-ellipsis text-slate-800 caret-transparent"
          value={surveyUrl}
        />
      ) : (
        //loading state
        <div
          data-testid="loading-div"
          className="mt-2 h-10 w-full min-w-96 animate-pulse rounded-lg bg-slate-100 px-4 py-2 text-slate-800 caret-transparent"></div>
      )}
    </>
  );
};
