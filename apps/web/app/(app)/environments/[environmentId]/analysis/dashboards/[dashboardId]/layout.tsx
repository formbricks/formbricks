import type { ReactNode } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";

const DashboardDetailLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <PageContentWrapper>{children}</PageContentWrapper>;
};

export default DashboardDetailLayout;
