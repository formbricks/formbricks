"use client";

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TDisplayWithContact } from "@formbricks/types/displays";
import { TUserLocale } from "@formbricks/types/user";
import { getDisplaysWithContactAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { timeSince } from "@/lib/time";
import { Button } from "@/modules/ui/components/button";

const DISPLAYS_PER_PAGE = 15;

interface SummaryImpressionsProps {
  surveyId: string;
  environmentId: string;
  locale: TUserLocale;
}

export const SummaryImpressions = ({ surveyId, environmentId, locale }: SummaryImpressionsProps) => {
  const { t } = useTranslation();
  const [displays, setDisplays] = useState<TDisplayWithContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const fetchDisplays = useCallback(
    async (offset: number) => {
      const response = await getDisplaysWithContactAction({
        surveyId,
        limit: DISPLAYS_PER_PAGE,
        offset,
      });

      if (response?.data) {
        return response.data;
      }
      return [];
    },
    [surveyId]
  );

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      const data = await fetchDisplays(0);
      setDisplays(data);
      setHasMore(data.length === DISPLAYS_PER_PAGE);
      setIsLoading(false);
    };
    loadInitial();
  }, [fetchDisplays]);

  const handleLoadMore = async () => {
    const data = await fetchDisplays(displays.length);
    setDisplays((prev) => [...prev, ...data]);
    setHasMore(data.length === DISPLAYS_PER_PAGE);
  };

  const getDisplayContactIdentifier = (display: TDisplayWithContact): string => {
    if (!display.contact) return "";
    return display.contact.attributes?.email || display.contact.attributes?.userId || display.contact.id;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <InfoIcon className="h-4 w-4 shrink-0" />
        <span>{t("environments.surveys.summary.impressions_identified_only")}</span>
      </div>

      {displays.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          {t("environments.surveys.summary.no_identified_impressions")}
        </div>
      ) : (
        <>
          <div className="grid min-h-10 grid-cols-4 items-center border-b border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
            <div className="col-span-2 px-4 md:px-6">{t("common.user")}</div>
            <div className="col-span-2 px-4 md:px-6">{t("environments.contacts.survey_viewed_at")}</div>
          </div>

          <div className="max-h-[62vh] overflow-y-auto">
            {displays.map((display) => (
              <div
                key={display.id}
                className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-xs text-slate-800 last:border-transparent md:text-sm">
                <div className="col-span-2 pl-4 md:pl-6">
                  {display.contact ? (
                    <Link
                      className="ph-no-capture break-all text-slate-600 hover:underline"
                      href={`/environments/${environmentId}/contacts/${display.contact.id}`}>
                      {getDisplayContactIdentifier(display)}
                    </Link>
                  ) : (
                    <span className="break-all text-slate-600">{t("common.anonymous")}</span>
                  )}
                </div>
                <div className="col-span-2 px-4 text-slate-500 md:px-6">
                  {timeSince(display.createdAt.toISOString(), locale)}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center border-t border-slate-100 py-4">
              <Button onClick={handleLoadMore} variant="secondary" size="sm">
                {t("common.load_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
