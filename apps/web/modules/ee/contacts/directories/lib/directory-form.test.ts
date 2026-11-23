import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getContactDirectoryErrorMessage, getContactDirectoryFormSchema } from "./directory-form";

const t = ((key: string) => key) as unknown as TFunction;

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("getContactDirectoryFormSchema", () => {
  const schema = getContactDirectoryFormSchema(t, []);

  test("accepts one unnamed workspace", () => {
    expect(schema.safeParse({ name: "", matchingKey: "email", workspaceIds: ["w1"] }).success).toBe(true);
  });

  test("requires at least one workspace", () => {
    expect(messagesOf(schema.safeParse({ name: "EU", matchingKey: "email", workspaceIds: [] }))).toEqual([
      "workspace.settings.contact_directories.error_workspace_required",
    ]);
  });

  test("requires a name once two workspaces are picked", () => {
    expect(
      messagesOf(schema.safeParse({ name: "  ", matchingKey: "externalId", workspaceIds: ["w1", "w2"] }))
    ).toEqual(["workspace.settings.contact_directories.error_name_required"]);
  });

  test("refuses to let a workspace the directory already has leave it", () => {
    const manage = getContactDirectoryFormSchema(t, ["w1", "w2"]);

    expect(messagesOf(manage.safeParse({ name: "EU", matchingKey: "email", workspaceIds: ["w2"] }))).toEqual([
      "workspace.settings.contact_directories.error_workspace_cannot_leave",
    ]);
  });
});

describe("getContactDirectoryErrorMessage", () => {
  const problem = (code: string, status = 409) => new V3ApiError({ status, detail: "server text", code });

  test("translates the route's codes and falls back for anything else", () => {
    expect(getContactDirectoryErrorMessage(problem("contact_directory_name_taken"), t)).toBe(
      "workspace.settings.contact_directories.error_name_taken"
    );
    expect(getContactDirectoryErrorMessage(problem("contact_directory_workspace_not_movable"), t)).toBe(
      "workspace.settings.contact_directories.error_workspace_not_movable"
    );
    expect(getContactDirectoryErrorMessage(problem("internal_server_error", 500), t)).toBe(
      "workspace.settings.contact_directories.save_failed"
    );
  });
});
