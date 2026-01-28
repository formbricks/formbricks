"use client";

import { useState } from "react";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { CreateDashboardModal } from "./create-dashboard-modal";
import { DashboardsTable } from "./dashboards-table";
import { TDashboard } from "./types";

interface AnalyzeSectionProps {
  environmentId: string;
}

export function AnalyzeSection({ environmentId }: AnalyzeSectionProps) {
  const [dashboards, setDashboards] = useState<TDashboard[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateDashboard = (dashboard: TDashboard) => {
    setDashboards((prev) => [dashboard, ...prev]);
  };

  const handleDashboardClick = (dashboard: TDashboard) => {
    // TODO: Navigate to dashboard detail view
    console.log("Dashboard clicked:", dashboard);
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Analyze"
        cta={
          <CreateDashboardModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onCreateDashboard={handleCreateDashboard}
          />
        }
      />

      <div className="space-y-6">
        <DashboardsTable dashboards={dashboards} onDashboardClick={handleDashboardClick} />
      </div>
    </PageContentWrapper>
  );
}
