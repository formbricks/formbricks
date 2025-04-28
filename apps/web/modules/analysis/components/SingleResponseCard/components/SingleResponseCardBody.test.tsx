import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SingleResponseCardBody } from "./SingleResponseCardBody";

// Mocks for imported components to return identifiable elements
vi.mock("./QuestionSkip", () => ({
  QuestionSkip: (props: any) => <div data-testid="QuestionSkip">{props.status}</div>,
}));
vi.mock("./RenderResponse", () => ({
  RenderResponse: (props: any) => <div data-testid="RenderResponse">{props.responseData.toString()}</div>,
}));
vi.mock("./ResponseVariables", () => ({
  ResponseVariables: (props: any) => <div data-testid="ResponseVariables">Variables</div>,
}));
vi.mock("./HiddenFields", () => ({
  HiddenFields: (props: any) => <div data-testid="HiddenFields">Hidden</div>,
}));
vi.mock("./VerifiedEmail", () => ({
  VerifiedEmail: (props: any) => <div data-testid="VerifiedEmail">VerifiedEmail</div>,
}));

// Mocks for utility functions used inside component
vi.mock("@/lib/utils/recall", () => ({
  parseRecallInfo: vi.fn((headline, data) => "parsed:" + headline),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((headline) => headline),
}));
vi.mock("../util", () => ({
  isValidValue: (val: any) => {
    if (typeof val === "string") return val.trim() !== "";
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "number") return true;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return false;
  },
}));
// Mock CheckCircle2Icon from lucide-react
vi.mock("lucide-react", () => ({
  CheckCircle2Icon: () => <div data-testid="CheckCircle2Icon">CheckCircle</div>,
}));

describe("SingleResponseCardBody", () => {
  afterEach(() => {
    cleanup();
  });

  const dummySurvey = {
    welcomeCard: { enabled: true },
    isVerifyEmailEnabled: true,
    questions: [
      { id: "q1", headline: "headline1" },
      { id: "q2", headline: "headline2" },
    ],
    variables: [{ id: "var1", name: "Variable1", type: "string" }],
    hiddenFields: { enabled: true, fieldIds: ["hf1"] },
  } as unknown as TSurvey;
  const dummyResponse = {
    id: "resp1",
    finished: true,
    data: { q1: "answer1", q2: "", verifiedEmail: true, hf1: "hiddenVal" },
    variables: { var1: "varValue" },
    language: "en",
  } as unknown as TResponse;

  test("renders welcomeCard branch when enabled", () => {
    render(<SingleResponseCardBody survey={dummySurvey} response={dummyResponse} skippedQuestions={[]} />);
    expect(screen.getAllByTestId("QuestionSkip")[0]).toHaveTextContent("welcomeCard");
  });

  test("renders VerifiedEmail when enabled and response verified", () => {
    render(<SingleResponseCardBody survey={dummySurvey} response={dummyResponse} skippedQuestions={[]} />);
    expect(screen.getByTestId("VerifiedEmail")).toBeInTheDocument();
  });

  test("renders RenderResponse for valid answer", () => {
    const surveyCopy = { ...dummySurvey, welcomeCard: { enabled: false } } as TSurvey;
    const responseCopy = { ...dummyResponse, data: { q1: "answer1", q2: "" } };
    render(<SingleResponseCardBody survey={surveyCopy} response={responseCopy} skippedQuestions={[]} />);
    // For question q1 answer is valid so RenderResponse is rendered
    expect(screen.getByTestId("RenderResponse")).toHaveTextContent("answer1");
  });

  test("renders QuestionSkip for invalid answer", () => {
    const surveyCopy = { ...dummySurvey, welcomeCard: { enabled: false } } as TSurvey;
    const responseCopy = { ...dummyResponse, data: { q1: "", q2: "" } };
    render(
      <SingleResponseCardBody survey={surveyCopy} response={responseCopy} skippedQuestions={[["q1"]]} />
    );
    // Renders QuestionSkip for q1 or q2 branch
    expect(screen.getAllByTestId("QuestionSkip")[1]).toBeInTheDocument();
  });

  test("renders ResponseVariables when variables exist", () => {
    render(<SingleResponseCardBody survey={dummySurvey} response={dummyResponse} skippedQuestions={[]} />);
    expect(screen.getByTestId("ResponseVariables")).toBeInTheDocument();
  });

  test("renders HiddenFields when hiddenFields enabled", () => {
    render(<SingleResponseCardBody survey={dummySurvey} response={dummyResponse} skippedQuestions={[]} />);
    expect(screen.getByTestId("HiddenFields")).toBeInTheDocument();
  });

  test("renders completion indicator when response finished", () => {
    render(<SingleResponseCardBody survey={dummySurvey} response={dummyResponse} skippedQuestions={[]} />);
    expect(screen.getByTestId("CheckCircle2Icon")).toBeInTheDocument();
    expect(screen.getByText("common.completed")).toBeInTheDocument();
  });

  test("processes question mapping correctly with skippedQuestions modification", () => {
    // Provide one question valid and one not valid, with skippedQuestions for the invalid one.
    const surveyCopy = { ...dummySurvey, welcomeCard: { enabled: false } } as TSurvey;
    const responseCopy = { ...dummyResponse, data: { q1: "answer1", q2: "" } };
    // Initially, skippedQuestions contains ["q2"].
    render(
      <SingleResponseCardBody survey={surveyCopy} response={responseCopy} skippedQuestions={[["q2"]]} />
    );
    // For q1, RenderResponse is rendered since answer valid.
    expect(screen.getByTestId("RenderResponse")).toBeInTheDocument();
    // For q2, QuestionSkip is rendered. Our mock for QuestionSkip returns text "skipped".
    expect(screen.getByText("skipped")).toBeInTheDocument();
  });
});
