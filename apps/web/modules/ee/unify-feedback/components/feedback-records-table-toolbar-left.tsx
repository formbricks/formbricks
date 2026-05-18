"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface FeedbackRecordsTableToolbarLeftProps {
  selectedCount: number;
  recordsCount: number;
  isEmpty: boolean;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export const FeedbackRecordsTableToolbarLeft = ({
  selectedCount,
  recordsCount,
  isEmpty,
  onClearSelection,
  onBulkDelete,
}: Readonly<FeedbackRecordsTableToolbarLeftProps>) => {
  const { t } = useTranslation();

  if (selectedCount > 0) {
    return (
      <div className="flex items-center gap-x-2 rounded-md bg-primary p-1 px-2 text-xs text-white">
        <span className="lowercase">
          {`${selectedCount} ${t("workspace.unify.feedback_records").toLowerCase()} ${t("common.selected")}`}
        </span>
        <span>|</span>
        <Button variant="outline" size="sm" className="h-6 border-none px-2" onClick={onClearSelection}>
          {t("common.clear_selection")}
        </Button>
        <span>|</span>
        <Button variant="secondary" size="sm" className="h-6 gap-1 px-2" onClick={onBulkDelete}>
          {t("common.delete")}
          <Trash2Icon />
        </Button>
      </div>
    );
  }

  if (isEmpty) {
    return <span />;
  }

  return (
    <p className="text-sm text-slate-500">
      {t("workspace.unify.showing_count_loaded", { count: recordsCount })}
    </p>
  );
};
