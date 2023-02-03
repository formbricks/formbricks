"use client";

import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";
import SettingsPage from "@/components/settings/SettingsPage";

export default function OrganisationFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <SettingsPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
