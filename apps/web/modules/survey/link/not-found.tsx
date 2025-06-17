import { HelpCircleIcon } from "lucide-react";

export const LinkSurveyNotFound = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-200 to-slate-50 py-8 text-center">
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        <HelpCircleIcon className="h-20 w-20" />
        <h1 className="text-4xl font-bold text-slate-800">Survey not found.</h1>
        <p className="text-lg leading-10 text-slate-500">There is no survey with this ID.</p>
      </div>
    </div>
  );
};
