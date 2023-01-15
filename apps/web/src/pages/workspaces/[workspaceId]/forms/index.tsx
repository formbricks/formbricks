"use client";

import FormsPage from "@/components/forms/FormsPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function WorkspaceFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <FormsPage />
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
