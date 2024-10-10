import { Code, HelpCircle, Link2Icon } from "lucide-react";

interface SurveyTypeIndicatorProps {
  type: string;
}

const surveyTypeConfig = {
  app: { icon: Code, label: "App" },
  link: { icon: Link2Icon, label: "Link" },
};

export const SurveyTypeIndicator = ({ type }: SurveyTypeIndicatorProps) => {
  const { icon: Icon, label } = surveyTypeConfig[type] || { icon: HelpCircle, label: "Unknown" };

  return (
    <div className="flex items-center space-x-2 text-sm text-slate-600">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
};
