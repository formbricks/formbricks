import type { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

interface WorkflowPageLayoutProps {
  children: ReactNode;
  cta?: ReactNode;
  navigation?: ReactNode;
  pageTitle: string;
}

export const WorkflowPageLayout = ({
  children,
  cta,
  navigation,
  pageTitle,
}: Readonly<WorkflowPageLayoutProps>) => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} cta={cta}>
        {navigation}
      </PageHeader>
      {children}
    </PageContentWrapper>
  );
};
