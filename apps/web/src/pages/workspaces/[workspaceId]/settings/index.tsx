"use client";

import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperWorkspace from "@/components/layout/LayoutWrapperWorkspace";
import SettingsPage from "@/components/settings/SettingsPage";

export default function WorkspaceFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperWorkspace>
        <SettingsPage />
      </LayoutWrapperWorkspace>
    </LayoutApp>
  );
}
