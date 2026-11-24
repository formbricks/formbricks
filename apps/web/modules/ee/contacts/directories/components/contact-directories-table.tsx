"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import type { TContactDirectory } from "../types";
import { ContactDirectoryRowMenu } from "./contact-directory-row-menu";

/** Module level: an inline `cell` returning JSX reads as a nested component to Sonar (typescript:S6478). */
const getContactDirectoryColumns = ({
  t,
  locale,
  onManage,
}: Readonly<{
  t: TFunction;
  locale: string;
  onManage: (directory: TContactDirectory) => void;
}>): TSettingsTableColumn<TContactDirectory>[] => [
  {
    id: "name",
    header: t("workspace.settings.contact_directories.directory_name"),
    headerClassName: "w-[38%]",
    cellClassName: "font-medium text-slate-900",
    skeletonWidth: "w-32",
    cell: (directory) => directory.name,
  },
  {
    id: "workspaces",
    header: t("common.workspaces"),
    headerClassName: "w-[18%]",
    skeletonWidth: "w-8",
    cell: (directory) => directory.workspaces.length,
  },
  {
    id: "matchingKey",
    header: t("workspace.settings.contact_directories.matches_by"),
    headerClassName: "w-[20%]",
    hideBelow: "sm",
    skeletonWidth: "w-16",
    cell: (directory) =>
      directory.matchingKey === "email"
        ? t("common.email")
        : t("workspace.settings.contact_directories.external_id"),
  },
  {
    id: "contacts",
    header: t("common.contacts"),
    headerClassName: "w-[16%]",
    hideBelow: "sm",
    skeletonWidth: "w-12",
    cell: (directory) => directory.contactCount.toLocaleString(locale),
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[8%]",
    stopRowClick: true,
    skeletonWidth: "w-8",
    // Flex on a wrapper, not on `cellClassName`, which would stop the `<td>` being a table cell.
    cell: (directory) => (
      <div className="flex justify-end">
        <ContactDirectoryRowMenu onManage={() => onManage(directory)} />
      </div>
    ),
  },
];

interface ContactDirectoriesTableProps {
  directories: TContactDirectory[];
  isLoading: boolean;
  onManage: (directory: TContactDirectory) => void;
}

/**
 * The list, as Feedback Sources draws it (spec decision 20): a `SettingsTable` with its own frame straight
 * under the page header. A row click opens Manage, and so does the menu at the end of the row.
 */
export const ContactDirectoriesTable = ({
  directories,
  isLoading,
  onManage,
}: Readonly<ContactDirectoriesTableProps>) => {
  const { t, i18n } = useTranslation();

  return (
    <SettingsTable
      columns={getContactDirectoryColumns({ t, locale: i18n.language, onManage })}
      rows={directories}
      getRowId={(directory) => directory.id}
      emptyMessage={t("workspace.settings.contact_directories.empty_state")}
      frame="card"
      isLoading={isLoading}
      aria-label={t("workspace.settings.contact_directories.title")}
      onRowClick={onManage}
      getRowLabel={(directory) => directory.name}
    />
  );
};
