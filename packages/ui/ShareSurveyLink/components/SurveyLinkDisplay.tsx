import { Input } from "../../Input";

interface SurveyLinkDisplayProps {
  surveyUrl: string;
}

export const SurveyLinkDisplay = ({ surveyUrl }: SurveyLinkDisplayProps) => {
  return (
    <Input
      autoFocus={true}
      className="mt-2 w-96 overflow-hidden text-ellipsis rounded-lg border bg-slate-50 px-3 py-2 text-center text-slate-800 caret-transparent"
      value={surveyUrl}
    />
  );
};
