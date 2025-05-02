import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MultipleChoiceSummary } from "./MultipleChoiceSummary";

vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: ({ personId }: any) => <div data-testid="avatar">{personId}</div>,
}));
vi.mock("./QuestionSummaryHeader", () => ({ QuestionSummaryHeader: () => <div data-testid="header" /> }));

describe("MultipleChoiceSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const baseSurvey = { id: "s1" } as any;
  const envId = "env";

  test("renders header and choice button", async () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q",
        headline: "H",
        type: "multipleChoiceSingle",
        choices: [{ id: "c", label: { default: "C" } }],
      },
      choices: { C: { value: "C", count: 1, percentage: 100, others: [] } },
      type: "multipleChoiceSingle",
      selectionCount: 0,
    } as any;
    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId={envId}
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );
    expect(screen.getByTestId("header")).toBeDefined();
    const btn = screen.getByText("1 - C");
    await userEvent.click(btn);
    expect(setFilter).toHaveBeenCalledWith(
      "q",
      "H",
      "multipleChoiceSingle",
      "environments.surveys.summary.includes_either",
      ["C"]
    );
  });

  test("renders others and load more for link", async () => {
    const setFilter = vi.fn();
    const others = Array.from({ length: 12 }, (_, i) => ({
      value: `O${i}`,
      contact: { id: `id${i}` },
      contactAttributes: {},
    }));
    const q = {
      question: {
        id: "q2",
        headline: "H2",
        type: "multipleChoiceMulti",
        choices: [{ id: "c2", label: { default: "X" } }],
      },
      choices: { X: { value: "X", count: 0, percentage: 0, others } },
      type: "multipleChoiceMulti",
      selectionCount: 5,
    } as any;
    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId={envId}
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );
    expect(screen.getByText("environments.surveys.summary.other_values_found")).toBeDefined();
    expect(screen.getAllByText(/^O/)).toHaveLength(10);
    await userEvent.click(screen.getByText("common.load_more"));
    expect(screen.getAllByText(/^O/)).toHaveLength(12);
  });

  test("renders others with avatar for app", () => {
    const setFilter = vi.fn();
    const others = [{ value: "Val", contact: { id: "uid" }, contactAttributes: {} }];
    const q = {
      question: {
        id: "q3",
        headline: "H3",
        type: "multipleChoiceMulti",
        choices: [{ id: "c3", label: { default: "L" } }],
      },
      choices: { L: { value: "L", count: 0, percentage: 0, others } },
      type: "multipleChoiceMulti",
      selectionCount: 1,
    } as any;
    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId={envId}
        surveyType="app"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );
    expect(screen.getByTestId("avatar")).toBeDefined();
    expect(screen.getByText("Val")).toBeDefined();
  });

  test("places choice without others before one with others", () => {
    const setFilter = vi.fn();
    const choices = {
      A: { value: "A", count: 0, percentage: 0, others: [] },
      B: { value: "B", count: 0, percentage: 0, others: [{ value: "x" }] },
    };
    render(
      <MultipleChoiceSummary
        questionSummary={
          {
            question: { id: "q", headline: "", type: "multipleChoiceSingle", choices: [] },
            choices,
            type: "multipleChoiceSingle",
            selectionCount: 0,
          } as any
        }
        environmentId="e"
        surveyType="link"
        survey={{} as any}
        setFilter={setFilter}
      />
    );
    const btns = screen.getAllByRole("button");
    expect(btns[0]).toHaveTextContent("2 - A");
    expect(btns[1]).toHaveTextContent("1 - B");
  });

  test("sorts by count when neither has others", () => {
    const setFilter = vi.fn();
    const choices = {
      X: { value: "X", count: 1, percentage: 50, others: [] },
      Y: { value: "Y", count: 2, percentage: 50, others: [] },
    };
    render(
      <MultipleChoiceSummary
        questionSummary={
          {
            question: { id: "q", headline: "", type: "multipleChoiceSingle", choices: [] },
            choices,
            type: "multipleChoiceSingle",
            selectionCount: 0,
          } as any
        }
        environmentId="e"
        surveyType="link"
        survey={{} as any}
        setFilter={setFilter}
      />
    );
    const btns = screen.getAllByRole("button");
    expect(btns[0]).toHaveTextContent("2 - Y50%2 common.selections");
    expect(btns[1]).toHaveTextContent("1 - X50%1 common.selection");
  });

  test("places choice with others after one without when reversed inputs", () => {
    const setFilter = vi.fn();
    const choices = {
      C: { value: "C", count: 1, percentage: 0, others: [{ value: "z" }] },
      D: { value: "D", count: 1, percentage: 0, others: [] },
    };
    render(
      <MultipleChoiceSummary
        questionSummary={
          {
            question: { id: "q", headline: "", type: "multipleChoiceSingle", choices: [] },
            choices,
            type: "multipleChoiceSingle",
            selectionCount: 0,
          } as any
        }
        environmentId="e"
        surveyType="link"
        survey={{} as any}
        setFilter={setFilter}
      />
    );
    const btns = screen.getAllByRole("button");
    expect(btns[0]).toHaveTextContent("2 - D");
    expect(btns[1]).toHaveTextContent("1 - C");
  });

  test("multi type non-other uses includes_all", async () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q4",
        headline: "H4",
        type: "multipleChoiceMulti",
        choices: [
          { id: "other", label: { default: "O" } },
          { id: "c4", label: { default: "C4" } },
        ],
      },
      choices: {
        O: { value: "O", count: 1, percentage: 10, others: [] },
        C4: { value: "C4", count: 2, percentage: 20, others: [] },
      },
      type: "multipleChoiceMulti",
      selectionCount: 0,
    } as any;

    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId={envId}
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );

    const btn = screen.getByText("2 - C4");
    await userEvent.click(btn);
    expect(setFilter).toHaveBeenCalledWith(
      "q4",
      "H4",
      "multipleChoiceMulti",
      "environments.surveys.summary.includes_all",
      ["C4"]
    );
  });

  test("multi type other uses includes_either", async () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q5",
        headline: "H5",
        type: "multipleChoiceMulti",
        choices: [
          { id: "other", label: { default: "O5" } },
          { id: "c5", label: { default: "C5" } },
        ],
      },
      choices: {
        O5: { value: "O5", count: 1, percentage: 10, others: [] },
        C5: { value: "C5", count: 0, percentage: 0, others: [] },
      },
      type: "multipleChoiceMulti",
      selectionCount: 0,
    } as any;

    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId={envId}
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );

    const btn = screen.getByText("2 - O5");
    await userEvent.click(btn);
    expect(setFilter).toHaveBeenCalledWith(
      "q5",
      "H5",
      "multipleChoiceMulti",
      "environments.surveys.summary.includes_either",
      ["O5"]
    );
  });
});
