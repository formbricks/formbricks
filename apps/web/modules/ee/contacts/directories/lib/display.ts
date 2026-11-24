import type { TFunction } from "i18next";
import type { TContactDirectory, TContactDirectoryList } from "../types";

/** An unnamed directory (one the migration made) shows its workspace's name (spec decision 2). */
export const getContactDirectoryDisplayName = (directory: TContactDirectory): string =>
  directory.name ?? directory.workspaces[0]?.name ?? "";

export type TWorkspacePickerOption = {
  value: string;
  label: string;
  disabled: boolean;
  /** Already uses the directory being managed: it stays chosen (decision 8, a workspace can't leave). */
  locked?: boolean;
  description?: string;
};

/**
 * The workspace picker's rows. A workspace can be picked when it has no directory, already uses the
 * directory being managed, or its own directory may be left (decision 8, decided by the server). Any other
 * row is greyed out with one fixed reason naming the directory it uses, never counts, so the picker leaks
 * nothing about what that directory holds.
 */
export const getWorkspacePickerOptions = ({
  list,
  t,
  currentDirectoryId,
}: {
  list: TContactDirectoryList;
  t: TFunction;
  currentDirectoryId?: string;
}): TWorkspacePickerOption[] => {
  const directoryById = new Map(list.directories.map((directory) => [directory.id, directory]));

  return list.workspaces
    .map((workspace): TWorkspacePickerOption => {
      const directory = workspace.directoryId ? directoryById.get(workspace.directoryId) : undefined;
      if (directory && directory.id === currentDirectoryId) {
        return { value: workspace.id, label: workspace.name, disabled: false, locked: true };
      }
      if (!directory || directory.workspaceCanMove) {
        return { value: workspace.id, label: workspace.name, disabled: false };
      }
      return {
        value: workspace.id,
        label: workspace.name,
        disabled: true,
        description: t("workspace.settings.contact_directories.workspace_uses_directory", {
          directoryName: getContactDirectoryDisplayName(directory),
        }),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
};
