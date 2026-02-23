"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardName: string;
  onDashboardNameChange: (name: string) => void;
  dashboardDescription: string;
  onDashboardDescriptionChange: (description: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}

export const CreateDashboardDialog = ({
  open,
  onOpenChange,
  dashboardName,
  onDashboardNameChange,
  dashboardDescription,
  onDashboardDescriptionChange,
  onCreate,
  isCreating,
}: Readonly<CreateDashboardDialogProps>) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.dashboards.create_dashboard")}</DialogTitle>
          <DialogDescription>
            {t("environments.analysis.dashboards.create_dashboard_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="dashboard-name" className="text-sm font-medium text-gray-900">
              {t("environments.analysis.dashboards.dashboard_name")}
            </label>
            <Input
              id="dashboard-name"
              placeholder={t("environments.analysis.dashboards.dashboard_name_placeholder")}
              value={dashboardName}
              onChange={(e) => onDashboardNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dashboardName.trim() && !isCreating) {
                  onCreate();
                }
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="dashboard-description" className="text-sm font-medium text-gray-900">
              {t("environments.analysis.dashboards.description_optional")}
            </label>
            <Input
              id="dashboard-description"
              placeholder={t("environments.analysis.dashboards.description_placeholder")}
              value={dashboardDescription}
              onChange={(e) => onDashboardDescriptionChange(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onCreate} loading={isCreating} disabled={!dashboardName.trim()}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
