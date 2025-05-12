import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  OptionsType,
  QuestionOption,
  QuestionOptions,
  QuestionsComboBox,
  SelectedCommandItem,
} from "./QuestionsComboBox";

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

describe("SelectedCommandItem", () => {
  test("renders question icon and color for QUESTIONS with questionType", () => {
    const { container } = render(
      <SelectedCommandItem
        label="Q1"
        type={OptionsType.QUESTIONS}
        questionType={TSurveyQuestionTypeEnum.OpenText}
      />
    );
    expect(container.querySelector(".bg-brand-dark")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Q1");
  });

  test("renders attribute icon and color for ATTRIBUTES", () => {
    const { container } = render(<SelectedCommandItem label="Attr" type={OptionsType.ATTRIBUTES} />);
    expect(container.querySelector(".bg-indigo-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Attr");
  });

  test("renders hidden field icon and color for HIDDEN_FIELDS", () => {
    const { container } = render(<SelectedCommandItem label="Hidden" type={OptionsType.HIDDEN_FIELDS} />);
    expect(container.querySelector(".bg-amber-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Hidden");
  });

  test("renders meta icon and color for META with label", () => {
    const { container } = render(<SelectedCommandItem label="device" type={OptionsType.META} />);
    expect(container.querySelector(".bg-amber-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("device");
  });

  test("renders other icon and color for OTHERS with label", () => {
    const { container } = render(<SelectedCommandItem label="Language" type={OptionsType.OTHERS} />);
    expect(container.querySelector(".bg-amber-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Language");
  });

  test("renders tag icon and color for TAGS", () => {
    const { container } = render(<SelectedCommandItem label="Tag1" type={OptionsType.TAGS} />);
    expect(container.querySelector(".bg-indigo-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("Tag1");
  });

  test("renders fallback color and no icon for unknown type", () => {
    const { container } = render(<SelectedCommandItem label="Unknown" type={"UNKNOWN"} />);
    expect(container.querySelector(".bg-amber-500")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.textContent).toContain("Unknown");
  });

  test("renders fallback for non-string label", () => {
    const { container } = render(
      <SelectedCommandItem label={{ default: "NonString" }} type={OptionsType.QUESTIONS} />
    );
    expect(container.textContent).toContain("NonString");
  });
});
