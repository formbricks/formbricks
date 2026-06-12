import type { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

interface WorkflowPageLayoutProps {
  children: ReactNode;
  navigation?: ReactNode;
  pageTitle: string;
}

export const WorkflowPageLayout = ({
  children,
  navigation,
  pageTitle,
}: Readonly<WorkflowPageLayoutProps>) => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle}>{navigation}</PageHeader>
      {children}
    </PageContentWrapper>
  );
};
