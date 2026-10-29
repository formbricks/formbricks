import type { ReactNode } from "react";
import { AnalysisQueryClientProvider } from "@/modules/ee/analysis/components/analysis-query-client-provider";

const AnalysisLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <AnalysisQueryClientProvider>{children}</AnalysisQueryClientProvider>
);

export default AnalysisLayout;
