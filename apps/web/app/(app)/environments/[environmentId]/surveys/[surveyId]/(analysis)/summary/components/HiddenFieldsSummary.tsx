"use client";

import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { InboxIcon, Link, MessageSquareTextIcon } from "lucide-react";
import { useState } from "react";
import { timeSince } from "@formbricks/lib/time";
import { getContactIdentifier } from "@formbricks/lib/utils/contact";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyQuestionSummaryHiddenFields } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface HiddenFieldsSummaryProps {
  environment: TEnvironment;
  questionSummary: TSurveyQuestionSummaryHiddenFields;
  locale: TUserLocale;
}

export const HiddenFieldsSummary = ({ environment, questionSummary, locale }: HiddenFieldsSummaryProps) => {
  const [visibleResponses, setVisibleResponses] = useState(10);
  const { t } = useTranslate();
  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.samples.length)
    );
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="space-y-2 px-4 pt-6 pb-5 md:px-6">
        <div className={"align-center flex justify-between gap-4"}>
          <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">{questionSummary.id}</h3>
        </div>

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <MessageSquareTextIcon className="mr-2 h-4 w-4" />
            Hidden Field
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {questionSummary.responseCount}{" "}
            {questionSummary.responseCount === 1 ? t("common.response") : t("common.responses")}
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">{t("common.user")}</div>
          <div className="col-span-2 pl-4 md:pl-6">{t("common.response")}</div>
          <div className="px-4 md:px-6">{t("common.time")}</div>
        </div>
        {questionSummary.samples.slice(0, visibleResponses).map((response, idx) => (
          <div
            key={`${response.value}-${idx}`}
            className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="pl-4 md:pl-6">
              {response.contact ? (
                <Link
                  className="ph-no-capture group flex items-center"
                  href={`/environments/${environment.id}/contacts/${response.contact.id}`}>
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
              {response.value}
            </div>
            <div className="px-4 text-slate-500 md:px-6">
              {timeSince(new Date(response.updatedAt).toISOString(), locale)}
            </div>
          </div>
        ))}
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
