"use client";

import FormsPage from "@/components/forms/FormsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function OrganisationFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <FormsPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
