"use client";

import { timeSince } from "@/lib/time";
import { getContactIdentifier } from "@/lib/utils/contact";
import { formatDateWithOrdinal } from "@/lib/utils/datetime";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useState } from "react";
import { TSurvey, TSurveyQuestionSummaryDate } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface DateQuestionSummary {
  questionSummary: TSurveyQuestionSummaryDate;
  environmentId: string;
  survey: TSurvey;
  locale: TUserLocale;
}

export const DateQuestionSummary = ({
  questionSummary,
  environmentId,
  survey,
  locale,
}: DateQuestionSummary) => {
  const { t } = useTranslate();
  const [visibleResponses, setVisibleResponses] = useState(10);

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.samples.length)
    );
  };

  const renderResponseValue = (value: string) => {
    const parsedDate = new Date(value);

    const formattedDate = isNaN(parsedDate.getTime())
      ? `${t("common.invalid_date")}(${value})`
      : formatDateWithOrdinal(parsedDate);

    return formattedDate;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />
      <div className="">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">{t("common.user")}</div>
          <div className="col-span-2 pl-4 md:pl-6">{t("common.response")}</div>
          <div className="px-4 md:px-6">{t("common.time")}</div>
        </div>
        <div className="max-h-[62vh] w-full overflow-y-auto">
          {questionSummary.samples.slice(0, visibleResponses).map((response) => (
            <div
              key={response.id}
              className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 last:border-transparent md:text-base">
              <div className="pl-4 md:pl-6">
                {response.contact ? (
                  <Link
                    className="ph-no-capture group flex items-center"
                    href={`/environments/${environmentId}/contacts/${response.contact.id}`}>
                    <div className="hidden md:flex">
                      <PersonAvatar personId={response.contact.id} />
                    </div>
                    <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                      {getContactIdentifier(response.contact, response.contactAttributes)}
                    </p>
                  </Link>
                ) : (
                  <div className="group flex items-center">
                    <div className="hidden md:flex">
                      <PersonAvatar personId="anonymous" />
                    </div>
                    <p className="break-all text-slate-600 md:ml-2">{t("common.anonymous")}</p>
                  </div>
                )}
              </div>
              <div className="ph-no-capture col-span-2 pl-6 font-semibold whitespace-pre-wrap">
                {renderResponseValue(response.value)}
              </div>
              <div className="px-4 text-slate-500 md:px-6">
                {timeSince(new Date(response.updatedAt).toISOString(), locale)}
              </div>
            </div>
          ))}
        </div>
        {visibleResponses < questionSummary.samples.length && (
          <div className="flex justify-center py-4">
            <Button onClick={handleLoadMore} variant="secondary" size="sm">
              {t("common.load_more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
