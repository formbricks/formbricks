import type { ReactNode } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";

const AnalysisLayout = async (props: { children: ReactNode; params: Promise<{ environmentId: string }> }) => {
  const { environmentId } = await props.params;
  const t = await getTranslate();

  return (
    <AnalysisPageLayout pageTitle={t("common.analysis")} environmentId={environmentId}>
      {props.children}
    </AnalysisPageLayout>
  );
};

export default AnalysisLayout;
