import type { TFunction } from "i18next";
import type { TContactDirectory, TContactDirectoryList, TContactDirectoryWorkspaceRef } from "../types";

export type TWorkspacePickerOption = {
  value: string;
  label: string;
  disabled: boolean;
  description?: string;
};

/**
 * The workspace picker's rows. A workspace can be picked when it has no directory or already uses the
 * directory being managed (whose chip can be taken off, to remove it). A workspace in another directory is
 * greyed out with that directory's name (decision 3): joining never moves a workspace.
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
      if (!directory || directory.id === currentDirectoryId) {
        return { value: workspace.id, label: workspace.name, disabled: false };
      }
      return {
        value: workspace.id,
        label: workspace.name,
        disabled: true,
        description: t("workspace.settings.contact_directories.workspace_in_directory", {
          directoryName: directory.name,
        }),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
};

/** The list's rows: archived directories only while "Show archived" is on (decision 5). */
export const getVisibleDirectories = (
  directories: TContactDirectory[],
  showArchived: boolean
): TContactDirectory[] => (showArchived ? directories : directories.filter((d) => !d.isArchived));

/** The directory's workspaces the picked list leaves out: the save removes them. */
export const getRemovedWorkspaces = (
  directory: TContactDirectory | undefined,
  workspaceIds: string[]
): TContactDirectoryWorkspaceRef[] => {
  if (!directory) return [];
  const picked = new Set(workspaceIds);
  return directory.workspaces.filter(({ id }) => !picked.has(id));
};

/**
 * What a save of the Manage dialog does to the directory: it removes workspaces (and asks first, decision
 * 2). Removing the last one leaves the directory active; archiving is a separate action (ADR 0062). An
 * archived directory is unarchived by its save.
 */
export const getDirectorySaveEffect = (
  directory: TContactDirectory | undefined,
  workspaceIds: string[]
): { removed: TContactDirectoryWorkspaceRef[]; unarchives: boolean } => ({
  removed: getRemovedWorkspaces(directory, workspaceIds),
  unarchives: Boolean(directory?.isArchived),
});
