import type { ReactNode } from "react";
import { ApiQueryClientProvider } from "@/modules/api/components/api-query-client-provider";

/**
 * One query cache for everything under the analysis routes, so the chart list, the dashboards and the chart
 * builder dialogs read and invalidate the same entries: a chart saved in a dialog updates the list behind it
 * without a page refresh.
 */
const AnalysisLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <ApiQueryClientProvider>{children}</ApiQueryClientProvider>
);

export default AnalysisLayout;
