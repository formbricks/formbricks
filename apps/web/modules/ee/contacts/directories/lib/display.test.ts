import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TContactDirectory, TContactDirectoryList } from "../types";
import {
  getDirectorySaveEffect,
  getRemovedWorkspaces,
  getVisibleDirectories,
  getWorkspacePickerOptions,
} from "./display";

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const directory = (id: string, extra: Partial<TContactDirectory> = {}): TContactDirectory => ({
  id,
  name: id,
  matchingKey: "email",
  isArchived: false,
  workspaces: [],
  contactCount: 0,
  ...extra,
});

const SHARED = directory("d-shared", {
  name: "Northwind US",
  workspaces: [
    { id: "w-a", name: "Market Access" },
    { id: "w-b", name: "Field Sales" },
  ],
});
const SOLO = directory("d-solo", { name: "Brand", workspaces: [{ id: "w-c", name: "Brand Tracking" }] });
const ARCHIVED = directory("d-archived", { name: "Old EU", isArchived: true });

const LIST: TContactDirectoryList = {
  directories: [SHARED, SOLO, ARCHIVED],
  workspaces: [
    { id: "w-a", name: "Market Access", directoryId: "d-shared" },
    { id: "w-b", name: "Field Sales", directoryId: "d-shared" },
    { id: "w-c", name: "Brand Tracking", directoryId: "d-solo" },
    { id: "w-e", name: "Ad Hoc", directoryId: null },
  ],
};

describe("getWorkspacePickerOptions", () => {
  // Decision 3: joining never moves a workspace, even out of a directory it is alone in.
  test("greys out every workspace in another directory, naming it, and sorts by name", () => {
    expect(getWorkspacePickerOptions({ list: LIST, t })).toEqual([
      { value: "w-e", label: "Ad Hoc", disabled: false },
      {
        value: "w-c",
        label: "Brand Tracking",
        disabled: true,
        description: `workspace.settings.contact_directories.workspace_in_directory {"directoryName":"Brand"}`,
      },
      {
        value: "w-b",
        label: "Field Sales",
        disabled: true,
        description: `workspace.settings.contact_directories.workspace_in_directory {"directoryName":"Northwind US"}`,
      },
      {
        value: "w-a",
        label: "Market Access",
        disabled: true,
        description: `workspace.settings.contact_directories.workspace_in_directory {"directoryName":"Northwind US"}`,
      },
    ]);
  });

  test("leaves the managed directory's own workspaces pickable and removable", () => {
    const options = getWorkspacePickerOptions({ list: LIST, t, currentDirectoryId: "d-shared" });

    expect(options.filter((option) => !option.disabled).map(({ value }) => value)).toEqual([
      "w-e",
      "w-b",
      "w-a",
    ]);
    expect(options.some((option) => "locked" in option)).toBe(false);
  });
});

describe("getVisibleDirectories", () => {
  test("hides archived directories unless Show archived is on", () => {
    expect(getVisibleDirectories(LIST.directories, false).map(({ id }) => id)).toEqual([
      "d-shared",
      "d-solo",
    ]);
    expect(getVisibleDirectories(LIST.directories, true).map(({ id }) => id)).toEqual([
      "d-shared",
      "d-solo",
      "d-archived",
    ]);
  });
});

describe("getRemovedWorkspaces", () => {
  test("names the directory's workspaces the picked list leaves out", () => {
    expect(getRemovedWorkspaces(SHARED, ["w-b", "w-e"])).toEqual([{ id: "w-a", name: "Market Access" }]);
    expect(getRemovedWorkspaces(undefined, [])).toEqual([]);
  });
});

describe("getDirectorySaveEffect", () => {
  test("removing some workspaces keeps the directory active", () => {
    expect(getDirectorySaveEffect(SHARED, ["w-b"])).toEqual({
      removed: [{ id: "w-a", name: "Market Access" }],
      removesLastWorkspace: false,
      unarchives: false,
    });
  });

  // The confirm step then notes the directory stays active; the save never archives it (ADR 0062).
  test("flags removing the last workspace", () => {
    expect(getDirectorySaveEffect(SOLO, [])).toMatchObject({ removesLastWorkspace: true, unarchives: false });
  });

  test("a save of an archived directory unarchives it, and a new directory does neither", () => {
    expect(getDirectorySaveEffect(ARCHIVED, ["w-e"])).toEqual({
      removed: [],
      removesLastWorkspace: false,
      unarchives: true,
    });
    expect(getDirectorySaveEffect(undefined, ["w-e"])).toEqual({
      removed: [],
      removesLastWorkspace: false,
      unarchives: false,
    });
  });
});
