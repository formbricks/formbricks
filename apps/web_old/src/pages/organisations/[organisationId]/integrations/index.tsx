"use client";

import IntegrationsPage from "@/components/integrations/IntegrationsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function IntegrationPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <IntegrationsPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
