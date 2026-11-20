import { HelpCircleIcon } from "lucide-react";
import { getTranslate } from "@/lingodotdev/server";

/** The 404 a respondent sees on a survey link (`/s`, `/p`, `/c`): no way into the dashboard. */
export const LinkSurveyNotFound = async () => {
  const t = await getTranslate();
  return (
    <div className="flex h-full flex-col items-center justify-center bg-linear-to-br from-slate-200 to-slate-50 py-8 text-center">
      <div className="flex flex-col items-center gap-y-3 text-slate-300">
        <HelpCircleIcon className="size-20" />
        <h1 className="text-4xl font-bold text-slate-800">{t("s.survey_not_found")}</h1>
        <p className="text-lg leading-10 text-slate-500">{t("s.survey_not_found_description")}</p>
      </div>
    </div>
  );
};
