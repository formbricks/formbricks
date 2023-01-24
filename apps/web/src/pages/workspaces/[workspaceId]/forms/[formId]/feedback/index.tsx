"use client";

import FeedbackPage from "@/components/forms/pmf/PMFPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";

export default function WorkspaceFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <FeedbackPage />
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
