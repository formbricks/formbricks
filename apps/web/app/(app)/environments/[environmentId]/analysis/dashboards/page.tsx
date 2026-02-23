import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";

const DashboardsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const { environmentId } = await props.params;
  const t = await getTranslate();

  return (
    <AnalysisPageLayout pageTitle={t("common.analysis")} environmentId={environmentId}>
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        {t("common.dashboards")} will appear here.
      </div>
    </AnalysisPageLayout>
  );
};

export default DashboardsPage;
