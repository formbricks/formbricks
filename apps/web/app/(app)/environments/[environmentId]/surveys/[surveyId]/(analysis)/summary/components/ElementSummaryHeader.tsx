"use client";

import { InboxIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummary } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getElementTypes } from "@/modules/survey/lib/elements";
import { IdBadge } from "@/modules/ui/components/id-badge";

interface HeadProps {
  elementSummary: TSurveyElementSummary;
  showResponses?: boolean;
  additionalInfo?: JSX.Element;
  survey: TSurvey;
}

export const ElementSummaryHeader = ({
  elementSummary,
  additionalInfo,
  showResponses = true,
  survey,
}: HeadProps) => {
  const { t } = useTranslation();
  const elementType = getElementTypes(t).find((type) => type.id === elementSummary.element.type);

  return (
    <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
      <div className={"align-center flex justify-between gap-4"}>
        <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">
          {formatTextWithSlashes(
            getTextContent(
              recallToHeadline(elementSummary.element.headline, survey, true, "default")["default"]
            ),
            "@",
            ["text-lg"]
          )}
        </h3>
      </div>
      <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
        <div className="flex items-center rounded-lg bg-slate-100 p-2">
          {elementType && <elementType.icon className="mr-2 h-4 w-4" />}
          {elementType ? elementType.label : t("environments.surveys.summary.unknown_question_type")}{" "}
          {t("common.question")}
        </div>
        {showResponses && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {`${elementSummary.responseCount} ${t("common.responses")}`}
          </div>
        )}
        {additionalInfo}
        {!elementSummary.element.required && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {t("environments.surveys.edit.optional")}
          </div>
        )}
        <IdBadge id={elementSummary.element.id} />
      </div>
    </div>
  );
};
