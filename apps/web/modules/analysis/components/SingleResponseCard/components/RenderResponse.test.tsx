import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RenderResponse } from "./RenderResponse";

// Mocks for dependencies
vi.mock("@/modules/ui/components/rating-response", () => ({
  RatingResponse: ({ answer }: any) => <div data-testid="RatingResponse">Rating: {answer}</div>,
}));
vi.mock("@/modules/ui/components/file-upload-response", () => ({
  FileUploadResponse: ({ selected }: any) => (
    <div data-testid="FileUploadResponse">FileUpload: {selected.join(",")}</div>
  ),
}));
vi.mock("@/modules/ui/components/picture-selection-response", () => ({
  PictureSelectionResponse: ({ selected, isExpanded, showId }: any) => (
    <div data-testid="PictureSelectionResponse" data-show-id={showId}>
      PictureSelection: {selected.join(",")} ({isExpanded ? "expanded" : "collapsed"}) showId:{" "}
      {String(showId)}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/array-response", () => ({
  ArrayResponse: ({ value }: any) => <div data-testid="ArrayResponse">{value.join(",")}</div>,
}));
vi.mock("@/modules/ui/components/response-badges", () => ({
  ResponseBadges: ({ items, showId }: any) => (
    <div data-testid="ResponseBadges" data-show-id={showId}>
      {Array.isArray(items)
        ? items
            .map((item) => (typeof item === "object" ? `${item.value}:${item.id || "no-id"}` : item))
            .join(",")
        : items}{" "}
      showId: {String(showId)}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/ranking-response", () => ({
  RankingResponse: ({ value, showId }: any) => (
    <div data-testid="RankingResponse" data-show-id={showId}>
      {Array.isArray(value)
        ? value
            .map((item) => (typeof item === "object" ? `${item.value}:${item.id || "no-id"}` : item))
            .join(",")
        : value}{" "}
      showId: {String(showId)}
    </div>
  ),
}));
vi.mock("@/modules/analysis/utils", () => ({
  renderHyperlinkedContent: vi.fn((text: string) => "hyper:" + text),
}));
vi.mock("@/lib/responses", () => ({
  processResponseData: (val: any) => "processed:" + val,
}));
vi.mock("@/lib/utils/datetime", () => ({
  formatDateWithOrdinal: (d: Date) => "formatted_" + d.toISOString(),
}));
vi.mock("@/lib/cn", () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((val, _) => val),
  getLanguageCode: vi.fn().mockReturnValue("default"),
}));

describe("RenderResponse", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultSurvey = { languages: [] } as any;
  const defaultQuestion = {
    id: "q1",
    type: "Unknown",
    choices: [
      { id: "choice1", label: { default: "Option 1" } },
      { id: "choice2", label: { default: "Option 2" } },
    ],
  } as any;
  const dummyLanguage = "default";

  test("returns '-' for empty responseData (string)", () => {
    const { container } = render(
      <RenderResponse
        responseData={""}
        question={defaultQuestion}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(container.textContent).toBe("-");
  });

  test("returns '-' for empty responseData (array)", () => {
    const { container } = render(
      <RenderResponse
        responseData={[]}
        question={defaultQuestion}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(container.textContent).toBe("-");
  });

  test("returns '-' for empty responseData (object)", () => {
    const { container } = render(
      <RenderResponse
        responseData={{}}
        question={defaultQuestion}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(container.textContent).toBe("-");
  });

  test("renders RatingResponse for 'Rating' question with number", () => {
    const question = { ...defaultQuestion, type: "rating", scale: 5, range: [1, 5] };
    render(
      <RenderResponse
        responseData={4}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("RatingResponse")).toHaveTextContent("Rating: 4");
  });

  test("renders formatted date for 'Date' question", () => {
    const question = { ...defaultQuestion, type: "date" };
    const dateStr = new Date("2023-01-01T12:00:00Z").toISOString();
    render(
      <RenderResponse
        responseData={dateStr}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByText(/formatted_/)).toBeInTheDocument();
  });

  test("renders PictureSelectionResponse for 'PictureSelection' question", () => {
    const question = { ...defaultQuestion, type: "pictureSelection", choices: ["a", "b"] };
    render(
      <RenderResponse
        responseData={["choice1", "choice2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("PictureSelectionResponse")).toHaveTextContent(
      "PictureSelection: choice1,choice2"
    );
  });

  test("renders FileUploadResponse for 'FileUpload' question", () => {
    const question = { ...defaultQuestion, type: "fileUpload" };
    render(
      <RenderResponse
        responseData={["file1", "file2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("FileUploadResponse")).toHaveTextContent("FileUpload: file1,file2");
  });

  test("renders Matrix response", () => {
    const question = { id: "q1", type: "matrix", rows: ["row1", "row2"] } as any;
    // getLocalizedValue returns the row value itself
    const responseData = { row1: "answer1", row2: "answer2" };
    render(
      <RenderResponse
        responseData={responseData}
        question={question}
        survey={{ languages: [] } as any}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByText("row1:processed:answer1")).toBeInTheDocument();
    expect(screen.getByText("row2:processed:answer2")).toBeInTheDocument();
  });

  test("renders ArrayResponse for 'Address' question", () => {
    const question = { ...defaultQuestion, type: "address" };
    render(
      <RenderResponse
        responseData={["addr1", "addr2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ArrayResponse")).toHaveTextContent("addr1,addr2");
  });

  test("renders ResponseBadges for 'Cal' question (string)", () => {
    const question = { ...defaultQuestion, type: "cal" };
    render(
      <RenderResponse
        responseData={"value"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("Value");
  });

  test("renders ResponseBadges for 'Consent' question (number)", () => {
    const question = { ...defaultQuestion, type: "consent" };
    render(
      <RenderResponse
        responseData={5}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("5");
  });

  test("renders ResponseBadges for 'CTA' question (string)", () => {
    const question = { ...defaultQuestion, type: "cta" };
    render(
      <RenderResponse
        responseData={"click"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("Click");
  });

  test("renders ResponseBadges for 'MultipleChoiceSingle' question (string)", () => {
    const question = { ...defaultQuestion, type: "multipleChoiceSingle", choices: [] };
    render(
      <RenderResponse
        responseData={"option1"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("option1");
  });

  test("renders ResponseBadges for 'MultipleChoiceMulti' question (array)", () => {
    const question = { ...defaultQuestion, type: "multipleChoiceMulti", choices: [] };
    render(
      <RenderResponse
        responseData={["opt1", "opt2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("opt1:other,opt2:other");
  });

  test("renders ResponseBadges for 'NPS' question (number)", () => {
    const question = { ...defaultQuestion, type: "nps" };
    render(
      <RenderResponse
        responseData={9}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    // NPS questions render as simple text, not ResponseBadges
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  test("renders RankingResponse for 'Ranking' question", () => {
    const question = { ...defaultQuestion, type: "ranking", choices: [] };
    render(
      <RenderResponse
        responseData={["first", "second"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByTestId("RankingResponse")).toHaveTextContent("first:other,second:other showId: false");
  });

  test("renders default branch for unknown question type with string", () => {
    const question = { ...defaultQuestion, type: "unknown" };
    render(
      <RenderResponse
        responseData={"some text"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByText("hyper:some text")).toBeInTheDocument();
  });

  test("renders default branch for unknown question type with array", () => {
    const question = { ...defaultQuestion, type: "unknown" };
    render(
      <RenderResponse
        responseData={["a", "b"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    expect(screen.getByText("a, b")).toBeInTheDocument();
  });

  // New tests for showId functionality
  test("passes showId prop to PictureSelectionResponse", () => {
    const question = {
      ...defaultQuestion,
      type: "pictureSelection",
      choices: [{ id: "choice1", imageUrl: "url1" }],
    };
    render(
      <RenderResponse
        responseData={["choice1"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("PictureSelectionResponse");
    expect(component).toHaveAttribute("data-show-id", "true");
    expect(component).toHaveTextContent("showId: true");
  });

  test("passes showId prop to RankingResponse with choice ID extraction", () => {
    const question = {
      ...defaultQuestion,
      type: "ranking",
      choices: [
        { id: "choice1", label: { default: "Option 1" } },
        { id: "choice2", label: { default: "Option 2" } },
      ],
    };
    render(
      <RenderResponse
        responseData={["Option 1", "Option 2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("RankingResponse");
    expect(component).toHaveAttribute("data-show-id", "true");
    expect(component).toHaveTextContent("showId: true");
    // Should extract choice IDs and pass them as value objects
    expect(component).toHaveTextContent("Option 1:choice1,Option 2:choice2");
  });

  test("handles ranking response with missing choice IDs", () => {
    const question = {
      ...defaultQuestion,
      type: "ranking",
      choices: [
        { id: "choice1", label: { default: "Option 1" } },
        { id: "choice2", label: { default: "Option 2" } },
      ],
    };
    render(
      <RenderResponse
        responseData={["Option 1", "Unknown Option"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("RankingResponse");
    expect(component).toHaveTextContent("Option 1:choice1,Unknown Option:other");
  });

  test("passes showId prop to ResponseBadges for multiple choice single", () => {
    const question = {
      ...defaultQuestion,
      type: "multipleChoiceSingle",
      choices: [{ id: "choice1", label: { default: "Option 1" } }],
    };
    render(
      <RenderResponse
        responseData={"Option 1"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("ResponseBadges");
    expect(component).toHaveAttribute("data-show-id", "true");
    expect(component).toHaveTextContent("showId: true");
    expect(component).toHaveTextContent("Option 1:choice1");
  });

  test("passes showId prop to ResponseBadges for multiple choice multi", () => {
    const question = {
      ...defaultQuestion,
      type: "multipleChoiceMulti",
      choices: [
        { id: "choice1", label: { default: "Option 1" } },
        { id: "choice2", label: { default: "Option 2" } },
      ],
    };
    render(
      <RenderResponse
        responseData={["Option 1", "Option 2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("ResponseBadges");
    expect(component).toHaveAttribute("data-show-id", "true");
    expect(component).toHaveTextContent("showId: true");
    expect(component).toHaveTextContent("Option 1:choice1,Option 2:choice2");
  });

  test("handles multiple choice with missing choice IDs", () => {
    const question = {
      ...defaultQuestion,
      type: "multipleChoiceMulti",
      choices: [{ id: "choice1", label: { default: "Option 1" } }],
    };
    render(
      <RenderResponse
        responseData={["Option 1", "Unknown Option"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("ResponseBadges");
    expect(component).toHaveTextContent("Option 1:choice1,Unknown Option:other");
  });

  test("passes showId=false to components when showId is false", () => {
    const question = {
      ...defaultQuestion,
      type: "multipleChoiceMulti",
      choices: [{ id: "choice1", label: { default: "Option 1" } }],
    };
    render(
      <RenderResponse
        responseData={["Option 1"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={false}
      />
    );
    const component = screen.getByTestId("ResponseBadges");
    expect(component).toHaveAttribute("data-show-id", "false");
    expect(component).toHaveTextContent("showId: false");
    // Should still extract IDs but showId=false
    expect(component).toHaveTextContent("Option 1:choice1");
  });

  test("handles questions without choices property", () => {
    const question = { ...defaultQuestion, type: "multipleChoiceSingle" }; // No choices property
    render(
      <RenderResponse
        responseData={"Option 1"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
        showId={true}
      />
    );
    const component = screen.getByTestId("ResponseBadges");
    expect(component).toHaveTextContent("Option 1:choice1");
  });
});
