"use client";

import PMFPage from "@/components/forms/pmf/PMFPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function WorkspaceFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <PMFPage />
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
