import { getTranslate } from "@/lingodotdev/server";
import { ChartRow } from "@/modules/ee/analysis/charts/components/chart-row";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartsListProps {
  charts: TChartWithCreator[];
  environmentId: string;
  isReadOnly: boolean;
}

export const ChartsList = async ({ charts, environmentId, isReadOnly }: Readonly<ChartsListProps>) => {
  const t = await getTranslate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{t("common.title")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_by")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created_at")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.updated_at")}</div>
        <div className="col-span-1" />
      </div>
      {charts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("environments.analysis.charts.no_charts_found")}
        </p>
      ) : (
        charts.map((chart) => (
          <ChartRow key={chart.id} chart={chart} environmentId={environmentId} isReadOnly={isReadOnly} />
        ))
      )}
    </div>
  );
};
