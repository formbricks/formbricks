"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryOpenText } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getContactIdentifier } from "@/lib/utils/contact";
import { renderHyperlinkedContent } from "@/modules/analysis/utils";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface OpenTextSummaryProps {
  elementSummary: TSurveyElementSummaryOpenText;
  environmentId: string;
  survey: TSurvey;
  locale: TUserLocale;
}

export const OpenTextSummary = ({ elementSummary, environmentId, survey, locale }: OpenTextSummaryProps) => {
  const { t } = useTranslation();
  const [visibleResponses, setVisibleResponses] = useState(10);

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, elementSummary.samples.length)
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="border-t border-slate-200"></div>
      {elementSummary.samples.length === 0 ? (
        <div className="p-8">
          <EmptyState text={t("environments.surveys.summary.no_responses_found")} variant="simple" />
        </div>
      ) : (
        <div className="max-h-[40vh] overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="w-1/4">{t("common.user")}</TableHead>
                <TableHead className="w-2/4">{t("common.response")}</TableHead>
                <TableHead className="w-1/4">{t("common.time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elementSummary.samples.slice(0, visibleResponses).map((response) => (
                <TableRow key={response.id}>
                  <TableCell className="w-1/4">
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
                        <p className="break-normal text-slate-600 md:ml-2">{t("common.anonymous")}</p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="w-2/4 font-medium">
                    {typeof response.value === "string"
                      ? renderHyperlinkedContent(response.value)
                      : response.value}
                  </TableCell>
                  <TableCell className="w-1/4">
                    {timeSince(new Date(response.updatedAt).toISOString(), locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleResponses < elementSummary.samples.length && (
            <div className="flex justify-center py-4">
              <Button onClick={handleLoadMore} variant="secondary" size="sm">
                {t("common.load_more")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
