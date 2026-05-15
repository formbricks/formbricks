import { getTranslate } from "@/lingodotdev/server";
import { ChartRow } from "@/modules/ee/analysis/charts/components/chart-row";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

interface ChartsListProps {
  charts: TChartWithCreator[];
  workspaceId: string;
  isReadOnly: boolean;
  directories: { id: string; name: string }[];
}

export const ChartsList = async ({
  charts,
  workspaceId,
  isReadOnly,
  directories,
}: Readonly<ChartsListProps>) => {
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
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {t("workspace.analysis.charts.no_charts_found")}
            </p>
            <p className="text-sm text-slate-500">
              {t("workspace.analysis.charts.no_charts_found_description")}
            </p>
          </div>
          {!isReadOnly && <CreateChartButton workspaceId={workspaceId} directories={directories} />}
        </div>
      ) : (
        charts.map((chart) => (
          <ChartRow
            key={chart.id}
            chart={chart}
            workspaceId={workspaceId}
            isReadOnly={isReadOnly}
            directories={directories}
          />
        ))
      )}
    </div>
  );
};
