import { Input } from "@/modules/ui/components/input";

interface SurveyLinkDisplayProps {
  surveyUrl: string;
}

export const SurveyLinkDisplay = ({ surveyUrl }: SurveyLinkDisplayProps) => {
  return (
    <Input
      autoFocus={true}
      className="mt-2 w-full min-w-96 text-ellipsis rounded-lg border bg-white px-4 py-2 text-center text-slate-800 caret-transparent"
      defaultValue={surveyUrl}
    />
  );
};
