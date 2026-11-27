import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getContactDirectoryErrorMessage, getContactDirectoryFormSchema } from "./directory-form";

const t = ((key: string) => key) as unknown as TFunction;

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("getContactDirectoryFormSchema", () => {
  const create = getContactDirectoryFormSchema(t, "create");

  test("accepts a named directory with one workspace, trimming the name", () => {
    const result = create.safeParse({ name: "  EU  ", matchingKey: "userId", workspaceIds: ["w1"] });

    expect(result.data?.name).toBe("EU");
  });

  test("needs at least one workspace to create", () => {
    expect(messagesOf(create.safeParse({ name: "EU", matchingKey: "email", workspaceIds: [] }))).toEqual([
      "workspace.settings.contact_directories.error_workspace_required",
    ]);
  });

  // An active directory may have no workspaces, and unarchiving needs none (ADR 0062).
  test.each(["manage", "unarchive"] as const)("lets %s save with no workspaces", (mode) => {
    const schema = getContactDirectoryFormSchema(t, mode);

    expect(schema.safeParse({ name: "EU", matchingKey: "email", workspaceIds: [] }).success).toBe(true);
  });

  test.each(["", "   "])("requires a name, on create and on manage (%j)", (name) => {
    for (const mode of ["create", "manage"] as const) {
      const schema = getContactDirectoryFormSchema(t, mode);
      expect(messagesOf(schema.safeParse({ name, matchingKey: "email", workspaceIds: ["w1"] }))).toEqual([
        "workspace.settings.contact_directories.error_name_required",
      ]);
    }
  });

  test("refuses the old externalId matching key", () => {
    expect(create.safeParse({ name: "EU", matchingKey: "externalId", workspaceIds: ["w1"] }).success).toBe(
      false
    );
  });
});

describe("getContactDirectoryErrorMessage", () => {
  const problem = (code: string, status = 409) => new V3ApiError({ status, detail: "server text", code });

  test("translates the route's codes and falls back for anything else", () => {
    expect(getContactDirectoryErrorMessage(problem("contact_directory_name_taken"), t)).toBe(
      "workspace.settings.contact_directories.error_name_taken"
    );
    expect(
      getContactDirectoryErrorMessage(problem("contact_directory_workspace_in_other_directory"), t)
    ).toBe("workspace.settings.contact_directories.error_workspace_in_other_directory");
    expect(getContactDirectoryErrorMessage(problem("contact_directory_archived"), t)).toBe(
      "workspace.settings.contact_directories.error_archive_state_changed"
    );
    expect(getContactDirectoryErrorMessage(problem("internal_server_error", 500), t)).toBe(
      "workspace.settings.contact_directories.save_failed"
    );
  });
});
