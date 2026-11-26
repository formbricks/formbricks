import type { TFunction } from "i18next";
import { z } from "zod";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { CONTACT_DIRECTORY_MATCHING_KEYS } from "../types";
import { CONTACT_DIRECTORY_NAME_MAX_LENGTH } from "./constants";

/**
 * What the dialog is doing: creating a directory, managing an active one, or unarchiving an archived one.
 * Creating needs at least one workspace. Managing may take every workspace off, which leaves the directory
 * active unless the confirm step's archive box is ticked, and unarchiving needs none (ADR 0062).
 */
export type TContactDirectoryDialogMode = "create" | "manage" | "unarchive";

/** The create and manage dialog's rules, the same ones the route enforces. */
export const getContactDirectoryFormSchema = (t: TFunction, mode: TContactDirectoryDialogMode) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, t("workspace.settings.contact_directories.error_name_required"))
      .max(
        CONTACT_DIRECTORY_NAME_MAX_LENGTH,
        t("workspace.settings.contact_directories.error_name_too_long", {
          max: CONTACT_DIRECTORY_NAME_MAX_LENGTH,
        })
      ),
    matchingKey: z.enum(CONTACT_DIRECTORY_MATCHING_KEYS),
    workspaceIds:
      mode === "create"
        ? z.array(z.string()).min(1, t("workspace.settings.contact_directories.error_workspace_required"))
        : z.array(z.string()),
  });

export type TContactDirectoryFormData = z.infer<ReturnType<typeof getContactDirectoryFormSchema>>;

/**
 * A save error in the user's language: the route's own codes get their own text, anything else one fallback.
 * Literal `t()` calls, so the translation scanner sees every key.
 */
export const getContactDirectoryErrorMessage = (error: unknown, t: TFunction): string => {
  const code = error instanceof V3ApiError ? error.code : undefined;
  switch (code) {
    case "contact_directory_name_required":
      return t("workspace.settings.contact_directories.error_name_required");
    case "contact_directory_name_taken":
      return t("workspace.settings.contact_directories.error_name_taken");
    case "contact_directory_workspace_in_other_directory":
      return t("workspace.settings.contact_directories.error_workspace_in_other_directory");
    case "contact_directory_workspace_not_movable":
      return t("workspace.settings.contact_directories.error_workspace_not_movable");
    case "contact_directory_archived":
    case "contact_directory_archive_has_workspaces":
      return t("workspace.settings.contact_directories.error_archive_state_changed");
    default:
      return t("workspace.settings.contact_directories.save_failed");
  }
};
