"use client";

import { InboxIcon, Link, MessageSquareTextIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyElementSummaryHiddenFields } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getContactIdentifier } from "@/lib/utils/contact";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface HiddenFieldsSummaryProps {
  environment: TEnvironment;
  elementSummary: TSurveyElementSummaryHiddenFields;
  locale: TUserLocale;
}

export const HiddenFieldsSummary = ({ environment, elementSummary, locale }: HiddenFieldsSummaryProps) => {
  const [visibleResponses, setVisibleResponses] = useState(10);
  const { t } = useTranslation();
  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, elementSummary.samples.length)
    );
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <div className={"align-center flex justify-between gap-4"}>
          <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">{elementSummary.id}</h3>
        </div>

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <MessageSquareTextIcon className="mr-2 h-4 w-4" />
            Hidden Field
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {elementSummary.responseCount}{" "}
            {elementSummary.responseCount === 1 ? t("common.response") : t("common.responses")}
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">{t("common.user")}</div>
          <div className="col-span-2 pl-4 md:pl-6">{t("common.response")}</div>
          <div className="px-4 md:px-6">{t("common.time")}</div>
        </div>
        {elementSummary.samples.length === 0 ? (
          <div className="p-8">
            <EmptyState text={t("environments.surveys.summary.no_responses_found")} variant="simple" />
          </div>
        ) : (
          elementSummary.samples.slice(0, visibleResponses).map((response, idx) => (
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
              <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold">
                {response.value}
              </div>
              <div className="px-4 text-slate-500 md:px-6">
                {timeSince(new Date(response.updatedAt).toISOString(), locale)}
              </div>
            </div>
          ))
        )}
        {elementSummary.samples.length > 0 && visibleResponses < elementSummary.samples.length && (
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
