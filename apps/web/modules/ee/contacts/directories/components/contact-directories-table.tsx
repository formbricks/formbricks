"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import type { TContactDirectory } from "../types";

/**
 * Module level, as Feedback Datasets does: an inline `cell` returning JSX reads as a nested component
 * definition to Sonar (typescript:S6478).
 */
const getContactDirectoryColumns = ({
  t,
  locale,
  onManage,
  onUnarchive,
}: Readonly<{
  t: TFunction;
  locale: string;
  onManage: (directory: TContactDirectory) => void;
  onUnarchive: (directory: TContactDirectory) => void;
}>): TSettingsTableColumn<TContactDirectory>[] => [
  {
    id: "name",
    header: t("workspace.settings.contact_directories.directory_name"),
    headerClassName: "w-[32%]",
    cellClassName: "font-medium text-slate-900",
    skeletonWidth: "w-32",
    cell: (directory) => directory.name,
  },
  {
    id: "workspaces",
    header: t("common.workspaces"),
    headerClassName: "w-[13%]",
    skeletonWidth: "w-8",
    cell: (directory) => directory.workspaces.length,
  },
  {
    id: "matchingKey",
    header: t("workspace.settings.contact_directories.matches_by"),
    headerClassName: "w-[15%]",
    hideBelow: "sm",
    skeletonWidth: "w-16",
    cell: (directory) => (directory.matchingKey === "email" ? t("common.email") : t("common.user_id")),
  },
  {
    id: "contacts",
    header: t("common.contacts"),
    headerClassName: "w-[13%]",
    hideBelow: "sm",
    skeletonWidth: "w-12",
    cell: (directory) => directory.contactCount.toLocaleString(locale),
  },
  {
    id: "status",
    header: t("common.status"),
    headerClassName: "w-[12%]",
    skeletonWidth: "w-12",
    cell: (directory) =>
      directory.isArchived ? (
        <Badge type="gray" size="tiny" text={t("common.archived")} />
      ) : (
        <Badge type="success" size="tiny" text={t("common.active")} />
      ),
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[15%]",
    // The flex sits on a wrapper inside the cell, never on the `<td>`: see the Feedback Datasets table.
    cell: (directory) => (
      <div className="flex justify-end">
        {directory.isArchived ? (
          <Button size="sm" variant="secondary" onClick={() => onUnarchive(directory)}>
            {t("common.unarchive")}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onManage(directory)}>
            {t("common.manage")}
          </Button>
        )}
      </div>
    ),
  },
];

interface ContactDirectoriesTableProps {
  directories: TContactDirectory[];
  isLoading: boolean;
  /** Shown when there are no rows; the view says whether archived directories are hidden. */
  emptyMessage: string;
  onManage: (directory: TContactDirectory) => void;
  /** Opens Manage on an archived directory, whose Save unarchives it (ADR 0062). */
  onUnarchive: (directory: TContactDirectory) => void;
}

/**
 * The list, as Feedback Datasets draws it: a frameless `SettingsTable` running edge to edge in the view's
 * card. An active row has a Manage button; an archived row has an Unarchive button instead.
 */
export const ContactDirectoriesTable = ({
  directories,
  isLoading,
  emptyMessage,
  onManage,
  onUnarchive,
}: Readonly<ContactDirectoriesTableProps>) => {
  const { t, i18n } = useTranslation();

  return (
    <SettingsTable
      columns={getContactDirectoryColumns({ t, locale: i18n.language, onManage, onUnarchive })}
      rows={directories}
      getRowId={(directory) => directory.id}
      emptyMessage={emptyMessage}
      isLoading={isLoading}
      aria-label={t("workspace.settings.contact_directories.title")}
    />
  );
};
