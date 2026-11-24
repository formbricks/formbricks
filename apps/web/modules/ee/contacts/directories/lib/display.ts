import type { TFunction } from "i18next";
import type { TContactDirectoryList } from "../types";

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
      if (!directory) {
        return { value: workspace.id, label: workspace.name, disabled: false };
      }
      // Its directory is empty: picking the workspace moves it here, and the move deletes that directory.
      if (directory.workspaceCanMove) {
        return {
          value: workspace.id,
          label: workspace.name,
          disabled: false,
          description: t("workspace.settings.contact_directories.workspace_moves_here", {
            directoryName: directory.name,
          }),
        };
      }
      return {
        value: workspace.id,
        label: workspace.name,
        disabled: true,
        description: t("workspace.settings.contact_directories.workspace_uses_directory", {
          directoryName: directory.name,
        }),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
};

/**
 * The picked workspaces that move here out of another directory, each with the directory the save deletes
 * (decision 8: only an empty directory with one workspace can be left, and it goes when that workspace does).
 */
export const getMovingWorkspaces = ({
  list,
  workspaceIds,
  currentDirectoryId,
}: {
  list: TContactDirectoryList;
  workspaceIds: string[];
  currentDirectoryId?: string;
}): { workspaceName: string; directoryName: string }[] => {
  const directoryById = new Map(list.directories.map((directory) => [directory.id, directory]));
  const picked = new Set(workspaceIds);

  return list.workspaces.flatMap((workspace) => {
    const directory = workspace.directoryId ? directoryById.get(workspace.directoryId) : undefined;
    if (!picked.has(workspace.id) || !directory || directory.id === currentDirectoryId) return [];
    return [{ workspaceName: workspace.name, directoryName: directory.name }];
  });
};
