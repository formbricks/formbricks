import type { ReactNode } from "react";
import { ApiQueryClientProvider } from "@/modules/api/components/api-query-client-provider";

/**
 * One query cache for everything under the analysis routes, so the chart list, the dashboards and the chart
 * builder dialogs read and invalidate the same entries: a chart saved in a dialog updates the list behind it
 * without a page refresh. Nothing here is prefetched on the server, so data is stale at once: reopening a
 * dashboard or returning to the tab refetches it, and a save is checked against the latest `updatedAt`.
 */
const AnalysisLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <ApiQueryClientProvider staleTime={0}>{children}</ApiQueryClientProvider>
);

export default AnalysisLayout;
