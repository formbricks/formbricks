import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/preact";
// Ensure screen is imported
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
// Use test consistently
import { RenderSurvey } from "./render-survey";

// Stub SurveyContainer to render children and capture props
vi.mock("../wrappers/survey-container", () => ({
  SurveyContainer: (props: any) => (
    <div data-testid="container" {...props}>
      {props.children}
    </div>
  ),
}));

// Spy on Survey props
const surveySpy = vi.fn();
vi.mock("./survey", () => ({
  Survey: (props: any) => {
    surveySpy(props);
    return <div data-testid="survey" />;
  },
}));

describe("RenderSurvey", () => {
  beforeEach(() => {
    surveySpy.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders with default props and handles close", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [{ id: "e1", type: "question" }] } as any;

    render(
      (
        <RenderSurvey
          survey={survey}
          onClose={onClose}
          onFinished={onFinished}
          placement="center"
          darkOverlay={true}
          clickOutside={false}
          styling={{}}
          isBrandingEnabled={false}
          languageCode="en"
        />
      ) as any
    );

    const props = surveySpy.mock.calls[0][0];
    // clickOutside should respect placement center
    expect(props.clickOutside).toBe(false);

    // Test close triggers onClose after 1s
    props.onClose();
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalled();
  });

  test("onFinished skips close if redirectToUrl", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [{ id: "e1", type: "redirectToUrl" }] } as any;

    render(
      (
        <RenderSurvey
          survey={survey}
          onClose={onClose}
          onFinished={onFinished}
          styling={{}}
          isBrandingEnabled={false}
          languageCode="en"
        />
      ) as any
    );
    const props = surveySpy.mock.calls[0][0];

    props.onFinished();
    expect(onFinished).toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("onFinished closes after delay for non-redirect endings", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [{ id: "e1", type: "question" }] } as any;

    render(
      (
        <RenderSurvey
          survey={survey}
          onClose={onClose}
          onFinished={onFinished}
          styling={{}}
          isBrandingEnabled={false}
          languageCode="en"
        />
      ) as any
    );
    const props = surveySpy.mock.calls[0][0];

    props.onFinished();
    // after first delay (survey finish), close schedules another delay
    vi.advanceTimersByTime(3000);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalled();
  });

  test("onFinished does not auto-close when inline mode", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [] } as any;

    render(
      (
        <RenderSurvey
          survey={survey}
          onClose={onClose}
          onFinished={onFinished}
          mode="inline"
          styling={{}}
          isBrandingEnabled={false}
          languageCode="en"
        />
      ) as any
    );
    const props = surveySpy.mock.calls[0][0];

    props.onFinished();
    vi.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();
  });

  // New tests for surveyTypeStyles
  test("should apply correct styles for link surveys", () => {
    const propsForLinkSurvey = {
      survey: { type: "link", endings: [] },
      styling: {},
      isBrandingEnabled: false,
      languageCode: "en",
      onClose: vi.fn(),
      onFinished: vi.fn(),
      placement: "bottomRight",
      mode: "modal",
    } as any;

    const { container } = render(<RenderSurvey {...propsForLinkSurvey} />);
    const surveyContainerWrapper = container.querySelector('[data-testid="container"]');
    expect(surveyContainerWrapper).toHaveStyle({
      "--fb-survey-card-max-height": "56dvh",
      "--fb-survey-card-min-height": "0dvh",
    });
  });

  test("should apply correct styles for app (non-link) surveys", () => {
    const propsForAppSurvey = {
      survey: { type: "app", endings: [] },
      styling: {},
      isBrandingEnabled: false,
      languageCode: "en",
      onClose: vi.fn(),
      onFinished: vi.fn(),
      placement: "bottomRight",
      mode: "modal",
    } as any;

    const { container } = render(<RenderSurvey {...propsForAppSurvey} />);
    const surveyContainerWrapper = container.querySelector('[data-testid="container"]');
    expect(surveyContainerWrapper).toHaveStyle({
      "--fb-survey-card-max-height": "25dvh",
      "--fb-survey-card-min-height": "25dvh",
    });
  });
});
