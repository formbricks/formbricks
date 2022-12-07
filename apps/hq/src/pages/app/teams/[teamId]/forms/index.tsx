"use client";

import FormsPage from "@/components/forms/FormsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function TeamFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <FormsPage />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
