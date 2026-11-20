import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Command } from "cmdk";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmbeddedFieldRenameButton } from "./embedded-field-rename-button";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/ee/analysis/charts/hooks/use-rename-embedded-field", () => ({
  useRenameEmbeddedField: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("EmbeddedFieldRenameButton", () => {
  afterEach(cleanup);

  test("Enter on the ✎ opens the label popover inside the chip list's command root", () => {
    // The chip list wraps its chips in cmdk, whose root cancels every Enter before it clicks a button.
    render(
      <Command>
        <EmbeddedFieldRenameButton workspaceId="ws_1" field={{ name: "ed_region", key: "Region" }} />
      </Command>
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "workspace.analysis.charts.rename_field" }), {
      key: "Enter",
    });

    expect(screen.getByLabelText("workspace.analysis.charts.rename_field_name")).toHaveValue("Region");
  });
});
