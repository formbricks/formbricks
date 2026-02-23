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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface Dashboard {
  id: string;
  name: string;
}

interface AddToDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartName: string;
  onChartNameChange: (name: string) => void;
  dashboards: Dashboard[];
  selectedDashboardId: string;
  onDashboardSelect: (id: string) => void;
  onAdd: () => void;
  isSaving: boolean;
}

export function AddToDashboardDialog({
  open,
  onOpenChange,
  chartName,
  onChartNameChange,
  dashboards,
  selectedDashboardId,
  onDashboardSelect,
  onAdd,
  isSaving,
}: Readonly<AddToDashboardDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("environments.analysis.charts.add_chart_to_dashboard")}</DialogTitle>
          <DialogDescription>
            {t("environments.analysis.charts.add_chart_to_dashboard_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label htmlFor="chart-name" className="mb-2 block text-sm font-medium text-gray-700">
                {t("environments.analysis.charts.chart_name")}
              </label>
              <Input
                id="chart-name"
                placeholder={t("environments.analysis.charts.chart_name_placeholder")}
                value={chartName}
                onChange={(e) => onChartNameChange(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dashboard-select" className="mb-2 block text-sm font-medium text-gray-700">
                {t("environments.analysis.charts.dashboard")}
              </label>
              <Select value={selectedDashboardId} onValueChange={onDashboardSelect}>
                <SelectTrigger id="dashboard-select" className="w-full bg-white">
                  <SelectValue
                    placeholder={
                      dashboards.length === 0
                        ? t("environments.analysis.charts.no_dashboards_available")
                        : t("environments.analysis.charts.dashboard_select_placeholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] max-h-[200px]">
                  {dashboards.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-gray-500">
                      {t("environments.analysis.charts.no_dashboards_available")}
                    </div>
                  ) : (
                    dashboards.map((dashboard) => (
                      <SelectItem key={dashboard.id} value={dashboard.id}>
                        {dashboard.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {dashboards.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {t("environments.analysis.charts.no_dashboards_create_first")}
                </p>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onAdd} loading={isSaving} disabled={!selectedDashboardId}>
            {t("environments.analysis.charts.add_to_dashboard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
