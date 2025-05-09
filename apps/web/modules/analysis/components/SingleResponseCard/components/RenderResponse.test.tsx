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
  PictureSelectionResponse: ({ selected, isExpanded }: any) => (
    <div data-testid="PictureSelectionResponse">
      PictureSelection: {selected.join(",")} ({isExpanded ? "expanded" : "collapsed"})
    </div>
  ),
}));
vi.mock("@/modules/ui/components/array-response", () => ({
  ArrayResponse: ({ value }: any) => <div data-testid="ArrayResponse">{value.join(",")}</div>,
}));
vi.mock("@/modules/ui/components/response-badges", () => ({
  ResponseBadges: ({ items }: any) => <div data-testid="ResponseBadges">{items.join(",")}</div>,
}));
vi.mock("@/modules/ui/components/ranking-response", () => ({
  RankingResponse: ({ value }: any) => <div data-testid="RankingResponse">{value.join(",")}</div>,
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
  const defaultQuestion = { id: "q1", type: "Unknown" } as any;
  const dummyLanguage = "default";

  test("returns '-' for empty responseData (string)", () => {
    const { container } = render(
      <RenderResponse
        responseData={""}
        question={defaultQuestion}
        survey={defaultSurvey}
        language={dummyLanguage}
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
      />
    );
    expect(container.textContent).toBe("-");
  });

  test("renders RatingResponse for 'Rating' question with number", () => {
    const question = { ...defaultQuestion, type: "rating", scale: 5, range: [1, 5] };
    render(
      <RenderResponse responseData={4} question={question} survey={defaultSurvey} language={dummyLanguage} />
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
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("Value");
  });

  test("renders ResponseBadges for 'Consent' question (number)", () => {
    const question = { ...defaultQuestion, type: "consent" };
    render(
      <RenderResponse responseData={5} question={question} survey={defaultSurvey} language={dummyLanguage} />
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
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("Click");
  });

  test("renders ResponseBadges for 'MultipleChoiceSingle' question (string)", () => {
    const question = { ...defaultQuestion, type: "multipleChoiceSingle" };
    render(
      <RenderResponse
        responseData={"option1"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("option1");
  });

  test("renders ResponseBadges for 'MultipleChoiceMulti' question (array)", () => {
    const question = { ...defaultQuestion, type: "multipleChoiceMulti" };
    render(
      <RenderResponse
        responseData={["opt1", "opt2"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
      />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("opt1,opt2");
  });

  test("renders ResponseBadges for 'NPS' question (number)", () => {
    const question = { ...defaultQuestion, type: "nps" };
    render(
      <RenderResponse responseData={9} question={question} survey={defaultSurvey} language={dummyLanguage} />
    );
    expect(screen.getByTestId("ResponseBadges")).toHaveTextContent("9");
  });

  test("renders RankingResponse for 'Ranking' question", () => {
    const question = { ...defaultQuestion, type: "ranking" };
    render(
      <RenderResponse
        responseData={["first", "second"]}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
      />
    );
    expect(screen.getByTestId("RankingResponse")).toHaveTextContent("first,second");
  });

  test("renders default branch for unknown question type with string", () => {
    const question = { ...defaultQuestion, type: "unknown" };
    render(
      <RenderResponse
        responseData={"some text"}
        question={question}
        survey={defaultSurvey}
        language={dummyLanguage}
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
      />
    );
    expect(screen.getByText("a, b")).toBeInTheDocument();
  });
});
