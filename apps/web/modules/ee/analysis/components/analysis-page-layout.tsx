import { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AnalysisSecondaryNavigation } from "./analysis-secondary-navigation";

interface AnalysisPageLayoutProps {
  pageTitle: string;
  workspaceId: string;
  cta?: ReactNode;
  children: ReactNode;
}

export function AnalysisPageLayout({
  pageTitle,
  workspaceId,
  cta,
  children,
}: Readonly<AnalysisPageLayoutProps>) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={cta}>
        <AnalysisSecondaryNavigation workspaceId={workspaceId} />
      </PageHeader>
      {children}
    </PageContentWrapper>
  );
}
