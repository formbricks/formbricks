import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
    // wait for the onFinished timeout (3s) then the close timeout (1s)
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

  test("close clears any pending onFinished timeout", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [{ id: "e1", type: "question" }] } as any;
    const { unmount } = render(
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

    // schedule the onFinished-based close
    props.onFinished();
    // immediately manually close, which should clear that pending timeout
    props.onClose();

    // manual close schedules onClose in 1s
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledTimes(1);

    // advance past the original onFinished timeout (3s) + its would-be close delay
    vi.advanceTimersByTime(4000);
    // still only the one manual-close call
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
  });

  test("double close only schedules one onClose", () => {
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

    // first close schedules user onClose at t=1000
    props.onClose();
    vi.advanceTimersByTime(500);
    // before the first fires, call close again and clear it
    props.onClose();

    // advance to t=1000: first one would have fired if not cleared
    vi.advanceTimersByTime(500);
    expect(onClose).not.toHaveBeenCalled();

    // advance to t=1500: only the second close should now fire
    vi.advanceTimersByTime(500);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("cleanup on unmount clears pending timers (useEffect)", () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const survey = { endings: [{ id: "e1", type: "question" }] } as any;
    const { unmount } = render(
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

    // schedule both timeouts
    props.onFinished();
    props.onClose();

    // unmount should clear both pending timeouts
    unmount();

    // advance well past all delays
    vi.advanceTimersByTime(10000);
    expect(onClose).not.toHaveBeenCalled();
  });
});
