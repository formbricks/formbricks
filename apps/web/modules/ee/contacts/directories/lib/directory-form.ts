import type { TFunction } from "i18next";
import { z } from "zod";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { CONTACT_DIRECTORY_MATCHING_KEYS } from "../types";
import { CONTACT_DIRECTORY_NAME_MAX_LENGTH } from "./constants";

/**
 * The create and manage dialog's rules, the same ones the route enforces: a name (decision 2), at least one
 * workspace (decision 21), and no workspace leaving the directory it already uses (decision 8).
 * `initialWorkspaceIds` is empty when creating.
 */
export const getContactDirectoryFormSchema = (t: TFunction, initialWorkspaceIds: string[]) =>
  z
    .object({
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
      workspaceIds: z
        .array(z.string())
        .min(1, t("workspace.settings.contact_directories.error_workspace_required")),
    })
    .superRefine((data, ctx) => {
      if (initialWorkspaceIds.some((id) => !data.workspaceIds.includes(id))) {
        ctx.addIssue({
          code: "custom",
          path: ["workspaceIds"],
          message: t("workspace.settings.contact_directories.error_workspace_cannot_leave"),
        });
      }
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
    case "contact_directory_workspace_cannot_leave":
      return t("workspace.settings.contact_directories.error_workspace_cannot_leave");
    case "contact_directory_workspace_not_movable":
      return t("workspace.settings.contact_directories.error_workspace_not_movable");
    default:
      return t("workspace.settings.contact_directories.save_failed");
  }
};
