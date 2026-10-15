import type { ReactNode } from "react";
import { DataRetentionLayout } from "@/modules/ee/data-retention/layout";

const Layout = (props: Readonly<{ params: Promise<{ organizationId: string }>; children: ReactNode }>) =>
  DataRetentionLayout(props);

export default Layout;
