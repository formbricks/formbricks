"use client";

import FeedbackPage from "@/components/forms/feedback/FeedbackPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperOrganisation from "@/components/layout/LayoutWrapperOrganisation";

export default function OrganisationFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperOrganisation>
        <FeedbackPage />
      </LayoutWrapperOrganisation>
    </LayoutApp>
  );
}
