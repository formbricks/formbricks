import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TContactDirectory, TContactDirectoryList } from "../types";
import { getContactDirectoryDisplayName, getWorkspacePickerOptions } from "./display";

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const directory = (id: string, extra: Partial<TContactDirectory>): TContactDirectory => ({
  id,
  name: null,
  matchingKey: "email",
  workspaces: [],
  contactCount: 0,
  workspaceCanMove: false,
  ...extra,
});

describe("getContactDirectoryDisplayName", () => {
  test("shows the name, or the workspace's name for an unnamed directory", () => {
    expect(getContactDirectoryDisplayName(directory("d1", { name: "Northwind EU" }))).toBe("Northwind EU");
    expect(
      getContactDirectoryDisplayName(directory("d2", { workspaces: [{ id: "w1", name: "Brand Tracking" }] }))
    ).toBe("Brand Tracking");
  });
});

describe("getWorkspacePickerOptions", () => {
  const list: TContactDirectoryList = {
    directories: [
      directory("d-shared", {
        name: "Northwind US",
        workspaces: [
          { id: "w-a", name: "Market Access" },
          { id: "w-b", name: "Field Sales" },
        ],
      }),
      directory("d-empty", { workspaces: [{ id: "w-c", name: "Brand Tracking" }], workspaceCanMove: true }),
      directory("d-full", { workspaces: [{ id: "w-d", name: "Patient Support" }], contactCount: 9 }),
    ],
    workspaces: [
      { id: "w-a", name: "Market Access", directoryId: "d-shared" },
      { id: "w-b", name: "Field Sales", directoryId: "d-shared" },
      { id: "w-c", name: "Brand Tracking", directoryId: "d-empty" },
      { id: "w-d", name: "Patient Support", directoryId: "d-full" },
      { id: "w-e", name: "Ad Hoc", directoryId: null },
    ],
  };

  test("greys out workspaces that can't move, naming the directory they use, and sorts by name", () => {
    expect(getWorkspacePickerOptions({ list, t })).toEqual([
      { value: "w-e", label: "Ad Hoc", disabled: false },
      { value: "w-c", label: "Brand Tracking", disabled: false },
      {
        value: "w-b",
        label: "Field Sales",
        disabled: true,
        description:
          'workspace.settings.contact_directories.workspace_uses_directory {"directoryName":"Northwind US"}',
      },
      {
        value: "w-a",
        label: "Market Access",
        disabled: true,
        description:
          'workspace.settings.contact_directories.workspace_uses_directory {"directoryName":"Northwind US"}',
      },
      {
        value: "w-d",
        label: "Patient Support",
        disabled: true,
        description:
          'workspace.settings.contact_directories.workspace_uses_directory {"directoryName":"Patient Support"}',
      },
    ]);
  });

  test("keeps the directory's own workspaces pickable when managing it", () => {
    const options = getWorkspacePickerOptions({ list, t, currentDirectoryId: "d-shared" });

    expect(options.find((option) => option.value === "w-a")).toEqual({
      value: "w-a",
      label: "Market Access",
      disabled: false,
    });
  });
});
