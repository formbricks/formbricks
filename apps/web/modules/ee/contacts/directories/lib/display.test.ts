import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TContactDirectory, TContactDirectoryList } from "../types";
import { getMovingWorkspaces, getWorkspacePickerOptions } from "./display";

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const directory = (id: string, extra: Partial<TContactDirectory>): TContactDirectory => ({
  id,
  name: id,
  matchingKey: "email",
  workspaces: [],
  contactCount: 0,
  workspaceCanMove: false,
  ...extra,
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
      directory("d-full", {
        name: "Patient Support",
        workspaces: [{ id: "w-d", name: "Patient Support" }],
        contactCount: 9,
      }),
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
      {
        value: "w-c",
        label: "Brand Tracking",
        disabled: false,
        description:
          'workspace.settings.contact_directories.workspace_moves_here {"directoryName":"d-empty"}',
      },
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

  test("keeps the directory's own workspaces chosen and locked when managing it", () => {
    const options = getWorkspacePickerOptions({ list, t, currentDirectoryId: "d-shared" });

    expect(options.find((option) => option.value === "w-a")).toEqual({
      value: "w-a",
      label: "Market Access",
      disabled: false,
      locked: true,
    });
    expect(options.find((option) => option.value === "w-e")?.locked).toBeUndefined();
  });
});

describe("getMovingWorkspaces", () => {
  const list: TContactDirectoryList = {
    directories: [
      directory("d-main", { name: "Main", workspaces: [{ id: "w-a", name: "Alpha" }] }),
      directory("d-empty", {
        name: "hey dir",
        workspaces: [{ id: "w-b", name: "Bravo" }],
        workspaceCanMove: true,
      }),
    ],
    workspaces: [
      { id: "w-a", name: "Alpha", directoryId: "d-main" },
      { id: "w-b", name: "Bravo", directoryId: "d-empty" },
      { id: "w-c", name: "Charlie", directoryId: null },
    ],
  };

  // Decision 8: the move deletes the empty directory the workspace leaves, so the dialog says so first.
  test("names each picked workspace that leaves another directory, and that directory", () => {
    expect(
      getMovingWorkspaces({ list, workspaceIds: ["w-a", "w-b", "w-c"], currentDirectoryId: "d-main" })
    ).toEqual([{ workspaceName: "Bravo", directoryName: "hey dir" }]);
  });

  test("names nothing for workspaces with no directory or not picked", () => {
    expect(getMovingWorkspaces({ list, workspaceIds: ["w-c"] })).toEqual([]);
    expect(getMovingWorkspaces({ list, workspaceIds: [], currentDirectoryId: "d-main" })).toEqual([]);
  });
});
