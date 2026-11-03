import { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AnalysisSecondaryNavigation } from "./analysis-secondary-navigation";

interface AnalysisPageLayoutProps {
  pageTitle: string;
  workspaceId: string;
  cta?: ReactNode;
  /** Hides the Dashboards / Charts tabs: a Dashboard viewer has no Charts (ADR-0018). */
  hideSecondaryNavigation?: boolean;
  children: ReactNode;
}

export function AnalysisPageLayout({
  pageTitle,
  workspaceId,
  cta,
  hideSecondaryNavigation = false,
  children,
}: Readonly<AnalysisPageLayoutProps>) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={cta}>
        {!hideSecondaryNavigation && <AnalysisSecondaryNavigation workspaceId={workspaceId} />}
      </PageHeader>
      {children}
    </PageContentWrapper>
  );
}
