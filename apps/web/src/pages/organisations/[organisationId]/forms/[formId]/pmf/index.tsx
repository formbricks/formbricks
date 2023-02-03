"use client";

import PMFPage from "@/components/forms/pmf/PMFPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function OrganisationFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <PMFPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
