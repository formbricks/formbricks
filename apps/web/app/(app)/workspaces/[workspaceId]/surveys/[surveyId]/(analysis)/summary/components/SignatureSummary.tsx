"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummarySignature } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { convertFloatToNDecimal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { timeSince } from "@/lib/time";
import { getClientOrigin } from "@/modules/storage/signature-image";
import { Button } from "@/modules/ui/components/button";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { SIGNATURE_SUMMARY_PAGE_SIZE, getSignatureTile } from "../lib/signature-summary";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { ResponseSampleModal } from "./ResponseSampleModal";

interface SignatureSummaryProps {
  elementSummary: TSurveyElementSummarySignature;
  survey: TSurvey;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const SignatureSummary = ({
  elementSummary,
  survey,
  locale,
  isReadOnly,
}: Readonly<SignatureSummaryProps>) => {
  const { t } = useTranslation();
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(SIGNATURE_SUMMARY_PAGE_SIZE);
  const origin = getClientOrigin();

  const counts = [
    { label: t("common.signed"), count: elementSummary.signedCount },
    { label: t("common.skipped"), count: elementSummary.skippedCount },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="space-y-5 px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        {counts.map(({ label, count }) => {
          const percentage =
            elementSummary.responseCount > 0 ? (count / elementSummary.responseCount) * 100 : 0;
          return (
            <div key={label}>
              <div className="flex justify-between px-2 pb-2">
                <div className="mr-8 flex gap-x-1">
                  <p className="font-semibold text-slate-700">{label}</p>
                  <div>
                    <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                      {convertFloatToNDecimal(percentage, 2)}%
                    </p>
                  </div>
                </div>
                <p className="flex w-32 items-end justify-end text-slate-600">
                  {t("common.count_responses", { count })}
                </p>
              </div>
              <ProgressBar barColor="bg-brand-dark" progress={percentage / 100} />
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 px-4 py-4 md:px-6">
        {elementSummary.signatures.length === 0 ? (
          <div className="p-4">
            <EmptyState text={t("workspace.surveys.summary.no_responses_found")} variant="simple" />
          </div>
        ) : (
          <ul className="flex flex-wrap gap-4" data-testid="signature-summary-list">
            {elementSummary.signatures.slice(0, visibleCount).map((signature) => {
              const tile = getSignatureTile(signature.value, origin);
              return (
                <li key={signature.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={t("workspace.surveys.summary.open_response_details")}
                    className="rounded-md focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                    onClick={() => setSelectedResponseId(signature.id)}>
                    {tile.kind === "image" ? (
                      <Image
                        src={tile.src}
                        alt={t("common.signature")}
                        width={144}
                        height={48}
                        unoptimized
                        className="h-12 w-36 max-w-full rounded-md border border-slate-200 bg-white object-contain"
                      />
                    ) : (
                      <span
                        className="ph-no-capture flex h-12 w-36 max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-left text-xs text-slate-700"
                        data-testid="signature-summary-text-tile">
                        <span className="truncate">{tile.text}</span>
                      </span>
                    )}
                  </button>
                  <p className="text-xs text-slate-500">
                    {timeSince(new Date(signature.updatedAt).toISOString(), locale)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {visibleCount < elementSummary.signatures.length && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => {
                setVisibleCount((count) =>
                  Math.min(count + SIGNATURE_SUMMARY_PAGE_SIZE, elementSummary.signatures.length)
                );
              }}
              variant="secondary"
              size="sm">
              {t("common.load_more")}
            </Button>
          </div>
        )}
      </div>
      <ResponseSampleModal
        responseId={selectedResponseId}
        onClose={() => setSelectedResponseId(null)}
        survey={survey}
        isReadOnly={isReadOnly}
        locale={locale}
      />
    </div>
  );
};
