import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";

interface SurveyLinkDisplayProps {
  surveyUrl: string;
  enforceSurveyUrlWidth?: boolean;
}

export const SurveyLinkDisplay = ({ surveyUrl, enforceSurveyUrlWidth = false }: SurveyLinkDisplayProps) => {
  return (
    <>
      {surveyUrl ? (
        <Input
          data-testid="survey-url-input"
          className={cn(
            "h-9 w-full text-ellipsis rounded-lg border bg-white px-3 py-1 text-slate-800 caret-transparent",
            {
              "min-w-96": enforceSurveyUrlWidth,
            }
          )}
          value={surveyUrl}
          readOnly
          aria-label="Survey URL"
        />
      ) : (
        //loading state
        <div
          data-testid="loading-div"
          className={cn(
            "h-9 w-full animate-pulse rounded-lg bg-slate-100 px-3 py-1 text-slate-800 caret-transparent",
            {
              "min-w-96": enforceSurveyUrlWidth,
            }
          )}
        />
      )}
    </>
  );
};
