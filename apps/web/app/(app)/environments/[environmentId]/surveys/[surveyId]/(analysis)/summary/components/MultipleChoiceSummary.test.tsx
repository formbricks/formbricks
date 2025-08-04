import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MultipleChoiceSummary } from "./MultipleChoiceSummary";

vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: ({ personId }: any) => <div data-testid="avatar">{personId}</div>,
}));
vi.mock("./QuestionSummaryHeader", () => ({ QuestionSummaryHeader: () => <div data-testid="header" /> }));
vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
  ),
}));

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
    expect(btns[0]).toHaveTextContent("2 - YID: other2 common.selections50%");
    expect(btns[1]).toHaveTextContent("1 - XID: other1 common.selection50%");
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

  // New tests for IdBadge functionality
  test("renders IdBadge when choice ID is found", () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q6",
        headline: "H6",
        type: "multipleChoiceSingle",
        choices: [
          { id: "choice1", label: { default: "Option A" } },
          { id: "choice2", label: { default: "Option B" } },
        ],
      },
      choices: {
        "Option A": { value: "Option A", count: 5, percentage: 50, others: [] },
        "Option B": { value: "Option B", count: 5, percentage: 50, others: [] },
      },
      type: "multipleChoiceSingle",
      selectionCount: 0,
    } as any;

    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId="env"
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
    expect(idBadges[0]).toHaveTextContent("ID: choice1");
    expect(idBadges[1]).toHaveTextContent("ID: choice2");
  });

  test("getChoiceIdByValue function correctly maps values to IDs", () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q8",
        headline: "H8",
        type: "multipleChoiceMulti",
        choices: [
          { id: "id-apple", label: { default: "Apple" } },
          { id: "id-banana", label: { default: "Banana" } },
          { id: "id-cherry", label: { default: "Cherry" } },
        ],
      },
      choices: {
        Apple: { value: "Apple", count: 3, percentage: 30, others: [] },
        Banana: { value: "Banana", count: 4, percentage: 40, others: [] },
        Cherry: { value: "Cherry", count: 3, percentage: 30, others: [] },
      },
      type: "multipleChoiceMulti",
      selectionCount: 0,
    } as any;

    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId="env"
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);

    // Check that each badge has the correct ID
    const expectedMappings = [
      { text: "Banana", id: "id-banana" }, // Highest count appears first
      { text: "Apple", id: "id-apple" },
      { text: "Cherry", id: "id-cherry" },
    ];

    expectedMappings.forEach(({ text, id }, index) => {
      expect(screen.getByText(`${3 - index} - ${text}`)).toBeInTheDocument();
      expect(idBadges[index]).toHaveAttribute("data-id", id);
    });
  });

  test("handles choices with special characters in labels", () => {
    const setFilter = vi.fn();
    const q = {
      question: {
        id: "q9",
        headline: "H9",
        type: "multipleChoiceSingle",
        choices: [
          { id: "special-1", label: { default: "Option & Choice" } },
          { id: "special-2", label: { default: "Choice with 'quotes'" } },
        ],
      },
      choices: {
        "Option & Choice": { value: "Option & Choice", count: 2, percentage: 50, others: [] },
        "Choice with 'quotes'": { value: "Choice with 'quotes'", count: 2, percentage: 50, others: [] },
      },
      type: "multipleChoiceSingle",
      selectionCount: 0,
    } as any;

    render(
      <MultipleChoiceSummary
        questionSummary={q}
        environmentId="env"
        surveyType="link"
        survey={baseSurvey}
        setFilter={setFilter}
      />
    );

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "special-1");
    expect(idBadges[1]).toHaveAttribute("data-id", "special-2");
  });
});
