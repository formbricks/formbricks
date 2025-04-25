import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { QuestionFilterComboBox } from "./QuestionFilterComboBox";

describe("QuestionFilterComboBox", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    filterOptions: ["A", "B"],
    filterComboBoxOptions: ["X", "Y"],
    filterValue: undefined,
    filterComboBoxValue: undefined,
    onChangeFilterValue: vi.fn(),
    onChangeFilterComboBoxValue: vi.fn(),
    handleRemoveMultiSelect: vi.fn(),
    disabled: false,
  };

  test("renders select placeholders", () => {
    render(<QuestionFilterComboBox {...defaultProps} />);
    expect(screen.getAllByText(/common.select\.../).length).toBe(2);
  });

  test("calls onChangeFilterValue when selecting filter", async () => {
    render(<QuestionFilterComboBox {...defaultProps} />);
    await userEvent.click(screen.getAllByRole("button")[0]);
    await userEvent.click(screen.getByText("A"));
    expect(defaultProps.onChangeFilterValue).toHaveBeenCalledWith("A");
  });

  test("calls onChangeFilterComboBoxValue when selecting combo box option", async () => {
    render(<QuestionFilterComboBox {...defaultProps} filterValue="A" />);
    await userEvent.click(screen.getAllByRole("button")[1]);
    await userEvent.click(screen.getByText("X"));
    expect(defaultProps.onChangeFilterComboBoxValue).toHaveBeenCalledWith("X");
  });

  test("multi-select removal works", async () => {
    const props = {
      ...defaultProps,
      type: "multipleChoiceMulti",
      filterValue: "A",
      filterComboBoxValue: ["X", "Y"],
    };
    render(<QuestionFilterComboBox {...props} />);
    const removeButtons = screen.getAllByRole("button", { name: /X/i });
    await userEvent.click(removeButtons[0]);
    expect(props.handleRemoveMultiSelect).toHaveBeenCalledWith(["Y"]);
  });

  test("disabled state prevents opening", async () => {
    render(<QuestionFilterComboBox {...defaultProps} disabled />);
    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByText("A")).toBeNull();
  });

  test("handles object options correctly", async () => {
    const obj = { default: "Obj1", en: "ObjEN" };
    const props = {
      ...defaultProps,
      type: "multipleChoiceMulti",
      filterValue: "A",
      filterComboBoxOptions: [obj],
      filterComboBoxValue: [],
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    await userEvent.click(screen.getAllByRole("button")[1]);
    await userEvent.click(screen.getByText("Obj1"));
    expect(props.onChangeFilterComboBoxValue).toHaveBeenCalledWith(["Obj1"]);
  });

  test("prevent combo-box opening when filterValue is Submitted", async () => {
    const props = { ...defaultProps, type: "NPS", filterValue: "Submitted" } as any;
    render(<QuestionFilterComboBox {...props} />);
    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(screen.queryByText("X")).toHaveClass("data-[disabled='true']:opacity-50");
  });

  test("prevent combo-box opening when filterValue is Skipped", async () => {
    const props = { ...defaultProps, type: "Rating", filterValue: "Skipped" } as any;
    render(<QuestionFilterComboBox {...props} />);
    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(screen.queryByText("X")).toHaveClass("data-[disabled='true']:opacity-50");
  });
});
