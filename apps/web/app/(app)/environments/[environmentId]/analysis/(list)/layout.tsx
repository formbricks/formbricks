import { AnalysisLayoutClient } from "@/modules/ee/analysis/components/analysis-layout-client";

const AnalysisListLayout = (props: {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}) => {
  return <AnalysisLayoutClient params={props.params}>{props.children}</AnalysisLayoutClient>;
};

export default AnalysisListLayout;
