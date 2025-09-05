import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { useTranslate } from "@tolgee/react";
import type { TSurveySummary } from "@formbricks/types/surveys/types";

interface QuotasSummaryProps {
  quotas: TSurveySummary["quotas"];
}

export const QuotasSummary = ({ quotas }: QuotasSummaryProps) => {
  const { t } = useTranslate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div>
        <div className="grid min-h-10 grid-cols-6 items-center rounded-t-xl border-b border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500">
          <div className="px-2">{t("common.progress")}</div>
          <div className="col-span-3 px-2">{t("common.label")}</div>
          <div className="px-2 text-right">{t("environments.surveys.summary.limit")}</div>
          <div className="px-2 text-right md:mr-1 md:pl-6">
            {t("environments.surveys.summary.current_count")}
          </div>
        </div>
        {quotas.length > 0 ? (
          quotas.map((quota) => (
            <div
              key={quota.id}
              className="grid h-[52px] grid-cols-6 border-b border-slate-100 text-xs text-slate-900 md:text-sm">
              <div className="col-span-1 flex h-full items-center justify-center p-2">
                <ProgressBar progress={quota.percentage / 100} barColor="bg-brand-dark" height={2} />
              </div>
              <div className="col-span-3 flex items-center whitespace-pre-wrap p-2">{quota.name}</div>
              <div className="flex items-center justify-end whitespace-pre-wrap p-2">{quota.limit}</div>
              <div className="flex items-center justify-end gap-2 p-2 text-right">
                <span className="rounded-xl bg-slate-100 px-2 py-1 text-xs">{quota.percentage}%</span>
                <span>{quota.count}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="grid h-[52px] border-b border-slate-100 text-xs text-slate-900 md:text-sm">
            <div className="flex items-center justify-center p-2">{t("common.no_quotas_found")}</div>
          </div>
        )}
      </div>
    </div>
  );
};
