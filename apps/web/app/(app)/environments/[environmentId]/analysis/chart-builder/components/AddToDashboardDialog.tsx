"use client";

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
}: AddToDashboardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Chart to Dashboard</DialogTitle>
          <DialogDescription>
            Select a dashboard to add this chart to. The chart will be saved automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label htmlFor="chart-name" className="mb-2 block text-sm font-medium text-gray-700">
                Chart Name
              </label>
              <Input
                id="chart-name"
                placeholder="Chart name"
                value={chartName}
                onChange={(e) => onChartNameChange(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dashboard-select" className="mb-2 block text-sm font-medium text-gray-700">
                Dashboard
              </label>
              <Select value={selectedDashboardId} onValueChange={onDashboardSelect}>
                <SelectTrigger id="dashboard-select" className="w-full bg-white">
                  <SelectValue
                    placeholder={dashboards.length === 0 ? "No dashboards available" : "Select a dashboard"}
                  />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] max-h-[200px]">
                  {dashboards.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-gray-500">No dashboards available</div>
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
                <p className="mt-1 text-xs text-gray-500">Create a dashboard first to add charts to it.</p>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onAdd} loading={isSaving} disabled={!selectedDashboardId}>
            Add to Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
