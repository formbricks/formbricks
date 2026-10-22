"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface DeleteChartDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspaceId: string;
  /** The dashboards holding the chart. While there are any, the chart cannot be deleted. */
  dashboards: { id: string; name: string }[];
  isDeleting: boolean;
  onDelete: () => void;
}

/**
 * Deleting a chart: the usual confirmation for a chart on no dashboard; for one still on dashboards, the
 * list of them instead, since the chart has to come off each one first.
 */
export const DeleteChartDialog = ({
  open,
  setOpen,
  workspaceId,
  dashboards,
  isDeleting,
  onDelete,
}: Readonly<DeleteChartDialogProps>) => {
  const { t } = useTranslation();

  if (dashboards.length === 0) {
    return (
      <DeleteDialog
        deleteWhat={t("common.chart")}
        open={open}
        setOpen={setOpen}
        onDelete={onDelete}
        text={t("workspace.analysis.charts.delete_chart_confirmation")}
        isDeleting={isDeleting}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.charts.chart_in_use_title")}</DialogTitle>
          <DialogDescription>
            {t("workspace.analysis.charts.chart_in_use_description", { count: dashboards.length })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {dashboards.map((dashboard) => (
              <li key={dashboard.id}>
                <Link
                  href={`/workspaces/${workspaceId}/dashboards/${dashboard.id}`}
                  className="text-slate-800 underline hover:text-slate-600">
                  {dashboard.name}
                </Link>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
