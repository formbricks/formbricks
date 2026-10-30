"use client";

import { Table } from "@tanstack/react-table";
import { FlagIcon, Undo2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TResponseTableData } from "@formbricks/types/responses";
import { Button } from "@/modules/ui/components/button";
import { useOutcomeAction } from "../hooks/use-outcome-action";
import { type TOutcomeActions, snapshotOutcomes } from "../lib/outcome";

interface BulkOutcomeActionsProps {
  table: Table<TResponseTableData>;
  workspaceId: string;
  actions: TOutcomeActions;
}

/**
 * The selection bar's outcome actions. They read the selection when clicked, and send only the rows the
 * action would change, so marking a mixed selection does not re-mark what is already marked.
 */
export const BulkOutcomeActions = ({ table, workspaceId, actions }: Readonly<BulkOutcomeActionsProps>) => {
  const { t } = useTranslation();
  const { run, isPending } = useOutcomeAction({ workspaceId, actions });
  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const toMark = selected.filter((row) => row.outcome !== "lowQuality");
  const toRestore = selected.filter((row) => row.outcome === "lowQuality");

  const apply = (rows: TResponseTableData[], outcome: "lowQuality" | null) => {
    const ids = rows.map((row) => row.responseId);
    run(
      ids,
      outcome,
      snapshotOutcomes(
        rows.map((row) => ({ id: row.responseId, outcome: row.outcome })),
        ids
      )
    );
    table.resetRowSelection();
  };

  return (
    <>
      {toMark.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 border-none px-2"
          disabled={isPending}
          onClick={() => apply(toMark, "lowQuality")}>
          <FlagIcon />
          {t("workspace.surveys.responses.mark_low_quality")}
        </Button>
      )}
      {toRestore.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 border-none px-2"
          disabled={isPending}
          onClick={() => apply(toRestore, null)}>
          <Undo2Icon />
          {t("workspace.surveys.responses.restore_as_complete")}
        </Button>
      )}
    </>
  );
};
