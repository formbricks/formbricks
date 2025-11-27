"use client";

import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryMultipleChoice, TSurveyType } from "@formbricks/types/surveys/types";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { getContactIdentifier } from "@/lib/utils/contact";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface MultipleChoiceSummaryProps {
  elementSummary: TSurveyElementSummaryMultipleChoice;
  environmentId: string;
  surveyType: TSurveyType;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const MultipleChoiceSummary = ({
  elementSummary,
  environmentId,
  surveyType,
  survey,
  setFilter,
}: MultipleChoiceSummaryProps) => {
  const { t } = useTranslation();
  const [visibleOtherResponses, setVisibleOtherResponses] = useState(10);
  const otherValue = elementSummary.element.choices.find((choice) => choice.id === "other")?.label.default;
  // sort by count and transform to array
  const results = Object.values(elementSummary.choices).sort((a, b) => {
    const aHasOthers = (a.others?.length ?? 0) > 0;
    const bHasOthers = (b.others?.length ?? 0) > 0;

    // if one has “others” and the other doesn’t, push the one with others to the end
    if (aHasOthers && !bHasOthers) return 1;
    if (!aHasOthers && bHasOthers) return -1;

    // if they’re “tied” on having others, fall back to count
    return b.count - a.count;
  });

  const handleLoadMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lastChoice = results[results.length - 1];
    const hasOthers = lastChoice.others && lastChoice.others.length > 0;

    if (!hasOthers) return; // If there are no 'others' to show, don't increase the visible options

    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleOtherResponses((prevVisibleOptions) =>
      Math.min(prevVisibleOptions + 10, lastChoice.others?.length || 0)
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader
        elementSummary={elementSummary}
        survey={survey}
        additionalInfo={
          elementSummary.type === "multipleChoiceMulti" ? (
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${elementSummary.selectionCount} ${t("common.selections")}`}
            </div>
          ) : undefined
        }
      />
      <div className="px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div className="space-y-5">
          {results.map((result) => {
            const choiceId = getChoiceIdByValue(result.value, elementSummary.element);
            return (
              <Fragment key={result.value}>
                <button
                  type="button"
                  className="group w-full cursor-pointer"
                  onClick={() =>
                    setFilter(
                      elementSummary.element.id,
                      elementSummary.element.headline,
                      elementSummary.element.type,
                      elementSummary.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
                        otherValue === result.value
                        ? t("environments.surveys.summary.includes_either")
                        : t("environments.surveys.summary.includes_all"),
                      [result.value]
                    )
                  }>
                  <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
                    <div className="mr-8 flex w-full justify-between space-x-2 sm:justify-normal">
                      <p className="font-semibold text-slate-700 underline-offset-4 group-hover:underline">
                        {result.value}
                      </p>
                      {choiceId && <IdBadge id={choiceId} />}
                    </div>
                    <div className="flex w-full space-x-2">
                      <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                        {result.count} {result.count === 1 ? t("common.selection") : t("common.selections")}
                      </p>
                      <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                        {convertFloatToNDecimal(result.percentage, 2)}%
                      </p>
                    </div>
                  </div>
                  <div className="group-hover:opacity-80">
                    <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100} />
                  </div>
                </button>
                {result.others && result.others.length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200">
                    <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                      <div className="col-span-1 pl-6">
                        {t("environments.surveys.summary.other_values_found")}
                      </div>
                      <div className="col-span-1 pl-6">{surveyType === "app" && t("common.user")}</div>
                    </div>
                    {result.others
                      .filter((otherValue) => otherValue.value !== "")
                      .slice(0, visibleOtherResponses)
                      .map((otherValue, idx) => (
                        <div key={`${idx}-${otherValue}`} dir="auto">
                          {surveyType === "link" && (
                            <div className="ph-no-capture col-span-1 m-2 flex h-10 items-center rounded-lg pl-4 text-sm font-medium text-slate-900">
                              <span>{otherValue.value}</span>
                            </div>
                          )}
                          {surveyType === "app" && otherValue.contact && (
                            <Link
                              href={
                                otherValue.contact.id
                                  ? `/environments/${environmentId}/contacts/${otherValue.contact.id}`
                                  : { pathname: null }
                              }
                              className="m-2 grid h-16 grid-cols-2 items-center rounded-lg text-sm hover:bg-slate-100">
                              <div className="ph-no-capture col-span-1 pl-4 font-medium text-slate-900">
                                <span>{otherValue.value}</span>
                              </div>
                              <div className="ph-no-capture col-span-1 flex items-center space-x-4 pl-6 font-medium text-slate-900">
                                {otherValue.contact.id && <PersonAvatar personId={otherValue.contact.id} />}
                                <span>
                                  {getContactIdentifier(otherValue.contact, otherValue.contactAttributes)}
                                </span>
                              </div>
                            </Link>
                          )}
                        </div>
                      ))}
                    {visibleOtherResponses < result.others.length && (
                      <div className="flex justify-center py-4">
                        <Button onClick={handleLoadMore} variant="secondary" size="sm">
                          {t("common.load_more")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
