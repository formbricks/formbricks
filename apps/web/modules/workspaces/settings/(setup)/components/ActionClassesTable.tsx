"use client";

import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { ACTION_TYPE_ICON_LOOKUP } from "@/modules/workspaces/settings/(setup)/app-connection/utils";
import { ActionDetailModal } from "./ActionDetailModal";

interface ActionClassesTableProps {
  actionClasses: TActionClass[];
  isReadOnly: boolean;
  locale: TUserLocale;
}

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478).
 *
 * This replaces a `children: [JSX.Element, JSX.Element[]]` tuple, where the header lived in
 * `ActionTableHeading` and the rows in `ActionClassDataRow`, each with its own `grid-cols-6` that had to
 * be kept in step by hand.
 */
const getActionClassColumns = ({
  t,
  locale,
}: Readonly<{ t: TFunction; locale: TUserLocale }>): TSettingsTableColumn<TActionClass>[] => [
  {
    id: "name",
    header: t("workspace.actions.user_actions"),
    headerClassName: "w-[65%]",
    skeletonWidth: "w-64",
    cell: (actionClass) => (
      // `title` is load-bearing, not decoration: `action.spec.ts` locates every row with
      // `getByTitle(name)` — five call sites, four of which click it to open the detail modal. The click
      // bubbles from here through the row activator to the row's own handler.
      <div className="flex items-center gap-4" title={actionClass.name}>
        <div className="size-5 shrink-0 text-slate-500">{ACTION_TYPE_ICON_LOOKUP[actionClass.type]}</div>
        <div className="text-left">
          <div className="font-medium wrap-break-word text-slate-900">{actionClass.name}</div>
          <div className="text-xs wrap-break-word text-slate-400">{actionClass.description}</div>
        </div>
      </div>
    ),
  },
  {
    id: "createdAt",
    header: t("common.created"),
    headerClassName: "w-[35%]",
    align: "center",
    cellClassName: "whitespace-nowrap text-slate-500",
    skeletonWidth: "w-20",
    cell: (actionClass) => timeSince(actionClass.createdAt.toString(), locale),
  },
];

export const ActionClassesTable = ({
  actionClasses,
  isReadOnly,
  locale,
}: Readonly<ActionClassesTableProps>) => {
  const { t } = useTranslation();
  const [isActionDetailModalOpen, setIsActionDetailModalOpen] = useState(false);
  const [activeActionClass, setActiveActionClass] = useState<TActionClass>();

  const handleOpenActionDetailModal = (actionClass: TActionClass) => {
    setActiveActionClass(actionClass);
    setIsActionDetailModalOpen(true);
  };

  return (
    <>
      <SettingsTable
        columns={getActionClassColumns({ t, locale })}
        rows={actionClasses}
        getRowId={(actionClass) => actionClass.id}
        emptyMessage={t("common.no_actions_found")}
        aria-label={t("common.actions")}
        onRowClick={handleOpenActionDetailModal}
        getRowLabel={(actionClass) => actionClass.name}
      />
      {activeActionClass && (
        <ActionDetailModal
          open={isActionDetailModalOpen}
          setOpen={setIsActionDetailModalOpen}
          actionClasses={actionClasses}
          actionClass={activeActionClass}
          isReadOnly={isReadOnly}
        />
      )}
    </>
  );
};
