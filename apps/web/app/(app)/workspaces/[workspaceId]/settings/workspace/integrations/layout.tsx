import { type ReactNode } from "react";
import { IntegrationsQueryClientProvider } from "./query-client-provider";

const IntegrationsSettingsLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <IntegrationsQueryClientProvider>{children}</IntegrationsQueryClientProvider>;
};

export default IntegrationsSettingsLayout;
