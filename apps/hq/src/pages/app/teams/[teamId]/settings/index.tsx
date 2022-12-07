"use client";

import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";
import SettingsPage from "@/components/settings/SettingsPage";

export default function TeamFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <SettingsPage />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
