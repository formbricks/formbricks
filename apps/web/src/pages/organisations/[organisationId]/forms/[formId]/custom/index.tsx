"use client";

import CustomPage from "@/components/forms/custom/CustomPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function OrganisationFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <CustomPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
