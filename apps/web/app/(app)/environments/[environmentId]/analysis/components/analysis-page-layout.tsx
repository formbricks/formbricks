import { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AnalysisSecondaryNavigation } from "./analysis-secondary-navigation";

interface AnalysisPageLayoutProps {
  pageTitle: string;
  activeId: string;
  environmentId: string;
  cta?: ReactNode;
  children: ReactNode;
}

export function AnalysisPageLayout({
  pageTitle,
  activeId,
  environmentId,
  cta,
  children,
}: AnalysisPageLayoutProps) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={cta}>
        <AnalysisSecondaryNavigation activeId={activeId} environmentId={environmentId} />
      </PageHeader>
      {children}
    </PageContentWrapper>
  );
}
