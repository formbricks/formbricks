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
    expect(screen.getAllByText("common.select...").length).toBe(2);
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

  test("combobox is disabled when filterValue is 'Submitted' for NPS questions", async () => {
    const props = { ...defaultProps, type: "nps", filterValue: "Submitted" } as any;
    render(<QuestionFilterComboBox {...props} />);
    const comboBoxOpenerButton = screen.getAllByRole("button")[1];
    expect(comboBoxOpenerButton).toBeDisabled();
    await userEvent.click(comboBoxOpenerButton);
    expect(screen.queryByText("X")).not.toBeInTheDocument();
  });

  test("combobox is disabled when filterValue is 'Skipped' for rating questions", async () => {
    const props = { ...defaultProps, type: "rating", filterValue: "Skipped" } as any;
    render(<QuestionFilterComboBox {...props} />);
    const comboBoxOpenerButton = screen.getAllByRole("button")[1];
    expect(comboBoxOpenerButton).toBeDisabled();
    await userEvent.click(comboBoxOpenerButton);
    expect(screen.queryByText("X")).not.toBeInTheDocument();
  });

  test("shows text input for URL meta field", () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "url",
      filterValue: "Contains",
      filterComboBoxValue: "example.com",
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    const textInput = screen.getByDisplayValue("example.com");
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveAttribute("type", "text");
  });

  test("text input is disabled when no filter value is selected for URL field", () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "url",
      filterValue: undefined,
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    const textInput = screen.getByRole("textbox");
    expect(textInput).toBeDisabled();
  });

  test("text input calls onChangeFilterComboBoxValue when typing for URL field", async () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "url",
      filterValue: "Contains",
      filterComboBoxValue: "",
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    const textInput = screen.getByRole("textbox");
    await userEvent.type(textInput, "t");
    expect(props.onChangeFilterComboBoxValue).toHaveBeenCalledWith("t");
  });

  test("shows regular combobox for non-URL meta fields", () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "source",
      filterValue: "Equals",
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  test("shows regular combobox for URL field with non-text operations", () => {
    const props = {
      ...defaultProps,
      type: "Other",
      fieldId: "url",
      filterValue: "Equals",
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  test("text input handles string filter combo box values correctly", () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "url",
      filterValue: "Contains",
      filterComboBoxValue: "test-url",
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    const textInput = screen.getByDisplayValue("test-url");
    expect(textInput).toBeInTheDocument();
  });

  test("text input handles non-string filter combo box values gracefully", () => {
    const props = {
      ...defaultProps,
      type: "Meta",
      fieldId: "url",
      filterValue: "Contains",
      filterComboBoxValue: ["array-value"],
    } as any;
    render(<QuestionFilterComboBox {...props} />);
    const textInput = screen.getByRole("textbox");
    expect(textInput).toHaveValue("");
  });
});
