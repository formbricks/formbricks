import { type ReactNode } from "react";
import { IntegrationsQueryClientProvider } from "./query-client-provider";

// A template, not a layout: it remounts on every navigation, so each integration page gets a fresh query
// client seeded from its own server render instead of a cached list a teammate may since have changed.
const IntegrationsSettingsTemplate = ({ children }: Readonly<{ children: ReactNode }>) => {
  return <IntegrationsQueryClientProvider>{children}</IntegrationsQueryClientProvider>;
};

export default IntegrationsSettingsTemplate;
