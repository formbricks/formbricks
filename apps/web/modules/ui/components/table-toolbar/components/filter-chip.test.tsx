import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FilterChip } from "./filter-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { filter?: string }) => `${key}:${values?.filter ?? ""}`,
  }),
}));

describe("FilterChip locked for you (ENG-7372)", () => {
  afterEach(cleanup);

  test("shows the hint, says why to a screen reader, and never offers ×", () => {
    render(
      <FilterChip
        label="Country"
        value="DE"
        accessibleName="Country DE"
        lockedHint="Set by your data access, from your Region attribute"
        lockedFor="you"
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTitle("Set by your data access, from your Region attribute")).toBeInTheDocument();
    expect(screen.getByText("common.table_toolbar.locked_for_you_filter:Country DE")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("a chip locked for everyone keeps its × for whoever may unlock it", () => {
    render(
      <FilterChip
        label="Country"
        value="DE"
        accessibleName="Country DE"
        lockedHint="Set by an editor"
        onRemove={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "common.table_toolbar.unlock_filter:Country DE" })
    ).toBeInTheDocument();
  });
});
