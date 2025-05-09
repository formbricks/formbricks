import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("renders with default props and handles close", () => {
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

  it("onFinished skips close if redirectToUrl", () => {
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

  it("onFinished closes after delay for non-redirect endings", () => {
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

  it("onFinished does not auto-close when inline mode", () => {
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
});
