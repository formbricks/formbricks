import { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AnalysisSecondaryNavigation } from "./analysis-secondary-navigation";

interface AnalysisPageLayoutProps {
  pageTitle: string;
  environmentId: string;
  cta?: ReactNode;
  children: ReactNode;
}

export function AnalysisPageLayout({
  pageTitle,
  environmentId,
  cta,
  children,
}: Readonly<AnalysisPageLayoutProps>) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={cta}>
        <AnalysisSecondaryNavigation environmentId={environmentId} />
      </PageHeader>
      {children}
    </PageContentWrapper>
  );
}
