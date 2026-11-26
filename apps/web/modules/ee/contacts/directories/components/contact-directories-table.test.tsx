import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TContactDirectory } from "../types";
import { ContactDirectoriesTable } from "./contact-directories-table";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en-US" } }),
}));

const NORTHWIND: TContactDirectory = {
  id: "cldir11111111111111111111",
  name: "Northwind",
  matchingKey: "email",
  isArchived: false,
  workspaces: [{ id: "clws111111111111111111111", name: "Alpha" }],
  contactCount: 1200,
};

const OLD: TContactDirectory = {
  ...NORTHWIND,
  id: "cldir22222222222222222222",
  name: "Old EU",
  matchingKey: "userId",
  isArchived: true,
  workspaces: [],
};

const renderTable = (directories: TContactDirectory[]) => {
  const onManage = vi.fn();
  const onUnarchive = vi.fn();
  render(
    <ContactDirectoriesTable
      directories={directories}
      isLoading={false}
      emptyMessage="empty"
      onManage={onManage}
      onUnarchive={onUnarchive}
    />
  );
  return { onManage, onUnarchive };
};

describe("ContactDirectoriesTable", () => {
  afterEach(cleanup);

  // As on the Feedback Datasets list, Manage is a button at the end of the row; the row itself isn't clickable.
  test("opens Manage from an active directory's Manage button, not from the row", () => {
    const { onManage } = renderTable([NORTHWIND]);

    fireEvent.click(screen.getByText("Northwind"));
    expect(onManage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "common.manage" }));

    expect(onManage).toHaveBeenCalledWith(NORTHWIND);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("common.active")).toBeInTheDocument();
  });

  test("gives an archived directory its status and an Unarchive button instead", () => {
    const { onManage, onUnarchive } = renderTable([OLD]);

    expect(screen.getByText("common.archived")).toBeInTheDocument();
    expect(screen.getByText("common.user_id")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.manage" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.unarchive" }));

    expect(onUnarchive).toHaveBeenCalledWith(OLD);
    expect(onManage).not.toHaveBeenCalled();
  });
});
