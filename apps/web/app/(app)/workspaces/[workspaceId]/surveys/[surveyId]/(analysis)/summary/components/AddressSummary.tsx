"use client";

import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryAddress } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { timeSince } from "@/lib/time";
import { ArrayResponse } from "@/modules/ui/components/array-response";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { SummaryResponseContact } from "./SummaryResponseContact";

interface AddressSummaryProps {
  readonly elementSummary: TSurveyElementSummaryAddress;
  readonly survey: TSurvey;
  readonly locale: TUserLocale;
}

export const AddressSummary = ({ elementSummary, survey, locale }: AddressSummaryProps) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div>
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">{t("common.user")}</div>
          <div className="col-span-2 pl-4 md:pl-6">{t("common.response")}</div>
          <div className="px-4 md:px-6">{t("common.time")}</div>
        </div>
        <div className="max-h-[62vh] w-full overflow-y-auto">
          {elementSummary.samples.length === 0 ? (
            <div className="p-8">
              <EmptyState text={t("workspace.surveys.summary.no_responses_found")} variant="simple" />
            </div>
          ) : (
            elementSummary.samples.map((response) => {
              return (
                <div
                  key={response.id}
                  className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 last:border-transparent md:text-base">
                  <div className="pl-4 md:pl-6">
                    <SummaryResponseContact
                      contact={response.contact}
                      contactAttributes={response.contactAttributes}
                      workspaceId={workspace?.id}
                    />
                  </div>
                  <div className="ph-no-capture col-span-2 pl-6 font-semibold">
                    <ArrayResponse value={response.value} />
                  </div>

                  <div className="px-4 text-slate-500 md:px-6">
                    {timeSince(new Date(response.updatedAt).toISOString(), locale)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
