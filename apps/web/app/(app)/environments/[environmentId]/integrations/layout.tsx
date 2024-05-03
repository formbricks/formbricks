import { Metadata } from "next";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "Integrations",
};

export default function IntegrationsLayout({ children }) {
  return <InnerContentWrapper pageTitle="Integrations">{children}</InnerContentWrapper>;
}
