import { Code, Link2Icon } from "lucide-react";

interface SurveyTypeIndicatorProps {
  type: string;
}

export const SurveyTypeIndicator = ({ type }: SurveyTypeIndicatorProps) => (
  <div className="flex items-center space-x-2 text-sm text-slate-600">
    {type === "app" && (
      <>
        <Code className="h-4 w-4" />
        <span>App</span>
      </>
    )}
    {type === "link" && (
      <>
        <Link2Icon className="h-4 w-4" />
        <span> Link</span>
      </>
    )}
  </div>
);
