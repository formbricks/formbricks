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
import { Label } from "@/modules/ui/components/label";

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardName: string;
  onDashboardNameChange: (name: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}

export const CreateDashboardDialog = ({
  open,
  onOpenChange,
  dashboardName,
  onDashboardNameChange,
  onCreate,
  isCreating,
}: Readonly<CreateDashboardDialogProps>) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.dashboards.create_dashboard")}</DialogTitle>
          <DialogDescription>
            {t("environments.analysis.dashboards.create_dashboard_description")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dashboardName.trim() && !isCreating) {
              onCreate();
            }
          }}
          className="space-y-4">
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">{t("environments.analysis.dashboards.dashboard_name")}</Label>
              <Input
                id="dashboard-name"
                placeholder={t("environments.analysis.dashboards.dashboard_name_placeholder")}
                value={dashboardName}
                onChange={(e) => onDashboardNameChange(e.target.value)}
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isCreating} disabled={!dashboardName.trim()}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
