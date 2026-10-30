import { type ReactNode } from "react";
import { ExportManagerProvider } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/export-manager";
import { SurveysQueryClientProvider } from "./query-client-provider";

const SurveysLayout = ({ children }: { children: ReactNode }) => {
  // The export manager sits here, above a survey's pages and its editor, so leaving the analysis pages
  // does not cancel a running export.
  return (
    <SurveysQueryClientProvider>
      <ExportManagerProvider>{children}</ExportManagerProvider>
    </SurveysQueryClientProvider>
  );
};

export default SurveysLayout;
