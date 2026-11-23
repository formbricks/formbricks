import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AllChipMultiSelect } from "./all-chip-multi-select";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, values?: { item?: string }) => `${key}:${values?.item ?? ""}` }),
}));

const options = [
  { value: "t1", label: "Berlin" },
  { value: "t2", label: "Lisbon" },
];

describe("AllChipMultiSelect", () => {
  afterEach(cleanup);

  test("with nothing chosen, shows one removable 'All' chip", () => {
    render(<AllChipMultiSelect options={options} value={[]} onChange={vi.fn()} allLabel="All teams" />);
    expect(screen.getByText("All teams")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.remove_item:All teams" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("removing the 'All' chip opens the picker with its input focused", () => {
    render(<AllChipMultiSelect options={options} value={[]} onChange={vi.fn()} allLabel="All teams" />);
    fireEvent.click(screen.getByRole("button", { name: "common.remove_item:All teams" }));
    expect(screen.queryByText("All teams")).not.toBeInTheDocument();
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  test("leaving the picker with nothing picked shows 'All' again", () => {
    render(
      <div>
        <AllChipMultiSelect options={options} value={[]} onChange={vi.fn()} allLabel="All teams" />
        <button type="button">elsewhere</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "common.remove_item:All teams" }));
    fireEvent.blur(document.activeElement as Element, { relatedTarget: screen.getByText("elsewhere") });
    expect(screen.getByText("All teams")).toBeInTheDocument();
  });

  test("shows picked items as ordinary chips", () => {
    render(<AllChipMultiSelect options={options} value={["t2"]} onChange={vi.fn()} allLabel="All teams" />);
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
    expect(screen.queryByText("All teams")).not.toBeInTheDocument();
  });

  test("disabled, shows the chips without a remove button", () => {
    const { rerender } = render(
      <AllChipMultiSelect options={options} value={[]} onChange={vi.fn()} allLabel="All teams" disabled />
    );
    expect(screen.getByText("All teams")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <AllChipMultiSelect options={options} value={["t1"]} onChange={vi.fn()} allLabel="All teams" disabled />
    );
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
