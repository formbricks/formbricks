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
  workspaces: [{ id: "clws111111111111111111111", name: "Alpha" }],
  contactCount: 1200,
  workspaceCanMove: false,
};

describe("ContactDirectoriesTable", () => {
  afterEach(cleanup);

  // Manage is the only thing a row does, so the row itself opens it; there's no options menu.
  test("opens Manage from the directory's name, with no options menu", () => {
    const onManage = vi.fn();
    render(<ContactDirectoriesTable directories={[NORTHWIND]} isLoading={false} onManage={onManage} />);

    fireEvent.click(screen.getByRole("button", { name: "Northwind" }));

    expect(onManage).toHaveBeenCalledWith(NORTHWIND);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("workspace.surveys.open_options")).toBeNull();
  });
});
