"use client";

import { EyeOffIcon, InboxIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummary } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";
import { getElementTypes } from "@/modules/survey/lib/elements";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { useNotShownCount } from "../lib/not-shown-counts";

interface HeadProps {
  readonly elementSummary: TSurveyElementSummary;
  readonly showResponses?: boolean;
  readonly additionalInfo?: JSX.Element;
  readonly survey: TSurvey;
}

export const ElementSummaryHeader = ({
  elementSummary,
  additionalInfo,
  showResponses = true,
  survey,
}: HeadProps) => {
  const { t } = useTranslation();
  const elementType = getElementTypes(t).find((type) => type.id === elementSummary.element.type);
  // Respondents a show-if kept the question from (ENG-6936): outside its base, so not in its counts.
  const notShownCount = useNotShownCount(elementSummary.element.id);

  return (
    <div
      className="space-y-2 px-4 pt-6 pb-5 md:px-6"
      data-testid={`element-summary-header-${elementSummary.element.id}`}>
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
      <div className="flex gap-x-2 text-xs font-semibold text-slate-600 md:text-sm">
        <div className="flex items-center rounded-lg bg-slate-100 p-2">
          {elementType && <elementType.icon className="mr-2 size-4" />}
          {elementType ? elementType.label : t("workspace.surveys.summary.unknown_question_type")}{" "}
          {t("common.question")}
        </div>
        {showResponses && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 size-4" />
            {t("common.count_responses", { count: elementSummary.responseCount })}
          </div>
        )}
        {notShownCount > 0 && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <EyeOffIcon className="mr-2 size-4" />
            {t("workspace.surveys.summary.not_shown_to_count", { count: notShownCount })}
          </div>
        )}
        {additionalInfo}
        {!elementSummary.element.required && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {t("workspace.surveys.edit.optional")}
          </div>
        )}
        <IdBadge id={getElementBadgeText(elementSummary.element)} />
      </div>
    </div>
  );
};
