import { AnalysisLayoutClient } from "@/modules/ee/analysis/dashboards/components/analysis-layout-client";

export default function AnalysisLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}) {
  return <AnalysisLayoutClient params={params}>{children}</AnalysisLayoutClient>;
}
