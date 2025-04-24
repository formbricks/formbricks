import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OptionsType, QuestionOption, QuestionOptions, QuestionsComboBox } from "./QuestionsComboBox";

describe("QuestionsComboBox", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions: QuestionOptions[] = [
    {
      header: OptionsType.QUESTIONS,
      option: [{ label: "Q1", type: OptionsType.QUESTIONS, questionType: undefined, id: "1" }],
    },
    {
      header: OptionsType.TAGS,
      option: [{ label: "Tag1", type: OptionsType.TAGS, id: "t1" }],
    },
  ];

  test("renders selected label when closed", () => {
    const selected: Partial<QuestionOption> = { label: "Q1", type: OptionsType.QUESTIONS, id: "1" };
    render(<QuestionsComboBox options={mockOptions} selected={selected} onChangeValue={() => {}} />);
    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  test("opens dropdown, selects an option, and closes", async () => {
    let currentSelected: Partial<QuestionOption> = {};
    const onChange = vi.fn((option) => {
      currentSelected = option;
    });

    const { rerender } = render(
      <QuestionsComboBox options={mockOptions} selected={currentSelected} onChangeValue={onChange} />
    );

    // Open the dropdown
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByPlaceholderText("common.search...")).toBeInTheDocument();

    // Select an option
    await userEvent.click(screen.getByText("Q1"));

    // Check if onChange was called
    expect(onChange).toHaveBeenCalledWith(mockOptions[0].option[0]);

    // Rerender with the new selected value
    rerender(<QuestionsComboBox options={mockOptions} selected={currentSelected} onChangeValue={onChange} />);

    // Check if the input is gone and the selected item is displayed
    expect(screen.queryByPlaceholderText("common.search...")).toBeNull();
    expect(screen.getByText("Q1")).toBeInTheDocument(); // Verify the selected item is now displayed
  });
});
