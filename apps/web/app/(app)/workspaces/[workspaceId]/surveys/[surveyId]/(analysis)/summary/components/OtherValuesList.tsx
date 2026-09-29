"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyElementSummaryMultipleChoice, TSurveyType } from "@formbricks/types/surveys/types";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getContactIdentifier } from "@/lib/utils/contact";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";

type TOtherValues = NonNullable<TSurveyElementSummaryMultipleChoice["choices"][number]["others"]>;

interface OtherValuesListProps {
  others: TOtherValues;
  surveyType: TSurveyType;
}

/** The free-text answers respondents typed into an "Other" option, ten at a time. */
export const OtherValuesList = ({ others, surveyType }: Readonly<OtherValuesListProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const [visibleOtherResponses, setVisibleOtherResponses] = useState(10);

  const handleLoadMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleOtherResponses((prevVisibleOptions) => Math.min(prevVisibleOptions + 10, others.length));
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-1 pl-6">{t("workspace.surveys.summary.other_values_found")}</div>
        <div className="col-span-1 pl-6">{surveyType === "app" && t("common.user")}</div>
      </div>
      {others
        .filter((otherValue) => otherValue.value !== "")
        .slice(0, visibleOtherResponses)
        .map((otherValue, idx) => (
          <div key={`${idx}-${otherValue.value}`} dir="auto">
            {surveyType === "link" && (
              <div className="ph-no-capture col-span-1 m-2 flex h-10 items-center rounded-lg pl-4 text-sm font-medium text-slate-900">
                <span>{otherValue.value}</span>
              </div>
            )}
            {surveyType === "app" && otherValue.contact && (
              <Link
                href={
                  otherValue.contact.id
                    ? `/workspaces/${workspace?.id}/contacts/${otherValue.contact.id}`
                    : { pathname: null }
                }
                className="m-2 grid h-16 grid-cols-2 items-center rounded-lg text-sm hover:bg-slate-100">
                <div className="ph-no-capture col-span-1 pl-4 font-medium text-slate-900">
                  <span>{otherValue.value}</span>
                </div>
                <div className="ph-no-capture col-span-1 flex items-center gap-x-4 pl-6 font-medium text-slate-900">
                  {otherValue.contact.id && <PersonAvatar personId={otherValue.contact.id} />}
                  <span>{getContactIdentifier(otherValue.contact, otherValue.contactAttributes)}</span>
                </div>
              </Link>
            )}
          </div>
        ))}
      {visibleOtherResponses < others.length && (
        <div className="flex justify-center py-4">
          <Button onClick={handleLoadMore} variant="secondary" size="sm">
            {t("common.load_more")}
          </Button>
        </div>
      )}
    </div>
  );
};
