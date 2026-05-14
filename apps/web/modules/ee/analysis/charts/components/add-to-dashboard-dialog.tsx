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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface AddToDashboardDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  chartName: string;
  onChartNameChange: (name: string) => void;
  dashboards: Array<{ id: string; name: string; containsChart?: boolean }>;
  selectedDashboardId: string | undefined;
  onDashboardSelect: (id: string) => void;
  onConfirm: () => void;
  isSaving: boolean;
  showChartNameField?: boolean;
}

export function AddToDashboardDialog({
  isOpen,
  onOpenChange,
  chartName,
  onChartNameChange,
  dashboards,
  selectedDashboardId,
  onDashboardSelect,
  onConfirm,
  isSaving,
  showChartNameField = true,
}: Readonly<AddToDashboardDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.charts.add_chart_to_dashboard")}</DialogTitle>
          <DialogDescription>
            {t("workspace.analysis.charts.add_chart_to_dashboard_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {showChartNameField && (
              <div>
                <Label htmlFor="chart-name">{t("workspace.analysis.charts.chart_name")}</Label>
                <Input
                  id="chart-name"
                  className="mt-2"
                  placeholder={t("workspace.analysis.charts.chart_name_placeholder")}
                  value={chartName}
                  onChange={(e) => onChartNameChange(e.target.value)}
                  maxLength={255}
                />
              </div>
            )}
            <div>
              <Label htmlFor="dashboard-select">{t("workspace.analysis.charts.dashboard")}</Label>
              <Select value={selectedDashboardId} onValueChange={onDashboardSelect}>
                <SelectTrigger
                  id="dashboard-select"
                  className="mt-2 w-full"
                  disabled={dashboards.length === 0}>
                  <SelectValue
                    placeholder={
                      dashboards.length === 0
                        ? t("workspace.analysis.charts.no_dashboards_available")
                        : t("workspace.analysis.charts.dashboard_select_placeholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[200px]">
                  {dashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={dashboard.id} disabled={dashboard.containsChart}>
                      {dashboard.name}
                      {dashboard.containsChart && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({t("workspace.analysis.charts.already_on_dashboard")})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dashboards.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {t("workspace.analysis.charts.no_dashboards_create_first")}
                </p>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            loading={isSaving}
            disabled={!selectedDashboardId || (showChartNameField && !chartName.trim())}>
            {t("workspace.analysis.charts.add_to_dashboard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
