// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { focusActiveTab, focusIssueTarget } from "./focus-issue";

// Runs the queued animation frames by hand, so a test decides when "the next frame" happens.
let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const queued = frames;
  frames = [];
  queued.forEach((callback) => callback(0));
};

const mount = (html: string) => {
  document.body.innerHTML = html;
};

let scrollIntoView: ReturnType<typeof vi.fn>;
let reducedMotion = false;

beforeEach(() => {
  frames = [];
  reducedMotion = false;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  window.matchMedia = vi.fn(() => ({ matches: reducedMotion })) as unknown as typeof window.matchMedia;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("focusIssueTarget", () => {
  test("focuses the input of the flagged field and scrolls it into view", () => {
    mount(`<div data-issue-field="q1:headline"><button>Bold</button><input id="field" /></div>`);

    focusIssueTarget({ targetId: "q1", field: "headline" });
    runFrame();

    // The toolbar button comes first in the wrapper; the input is the field.
    expect(document.activeElement?.id).toBe("field");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  test("scrolls without animation when the author asked for reduced motion", () => {
    reducedMotion = true;
    mount(`<div data-issue-field="q1:headline"><input /></div>`);

    focusIssueTarget({ targetId: "q1", field: "headline" });
    runFrame();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  test("waits frame by frame for a field that mounts after the tab changes", () => {
    mount("");

    focusIssueTarget({ targetId: "q1", field: "headline" });
    runFrame();
    runFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();

    mount(`<div data-issue-field="q1:headline"><input id="late" /></div>`);
    runFrame();

    expect(document.activeElement?.id).toBe("late");
  });

  test("falls back to the card itself when the field never appears", () => {
    mount(`<section id="q1" tabindex="0"><p>Question 1</p></section>`);

    focusIssueTarget({ targetId: "q1", field: "headline" });
    for (let frame = 0; frame < 25; frame++) runFrame();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  test("goes to a whole-card issue by the card's id, or by its Flow row id, and focuses its first control", () => {
    mount(`<div id="flow-block1"><button id="toggle">Block 1</button></div>`);

    focusIssueTarget({ targetId: "block1", field: null });
    runFrame();

    expect(document.activeElement?.id).toBe("toggle");
  });

  test("does nothing for an issue with no target", () => {
    focusIssueTarget({ targetId: null, field: "headline" });

    expect(frames).toHaveLength(0);
  });

  describe("with the live preview on the page", () => {
    const setup = () => {
      mount(
        `<div data-issue-field="q1:headline"><input id="field" /></div>` +
          `<div id="formbricks-survey-container"><button id="preview-button">Next</button></div>`
      );
      vi.useFakeTimers();
      focusIssueTarget({ targetId: "q1", field: "headline" });
      runFrame();
    };
    const previewTakesFocus = () => {
      const button = document.getElementById("preview-button") as HTMLElement;
      button.focus();
      button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    };

    test("hands focus back when the preview takes it just after the jump", () => {
      setup();

      previewTakesFocus();

      expect(document.activeElement?.id).toBe("field");
    });

    test("lets the author move into the preview once they press a key", () => {
      setup();

      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
      previewTakesFocus();

      expect(document.activeElement?.id).toBe("preview-button");
    });

    test("stops handing focus back after the window has passed", () => {
      setup();

      vi.advanceTimersByTime(1600);
      previewTakesFocus();

      expect(document.activeElement?.id).toBe("preview-button");
    });
  });
});

describe("focusActiveTab", () => {
  test("focuses the open tab", () => {
    mount(
      `<nav aria-label="Tabs"><button id="a">Questions</button><button id="b" aria-current="page">Language</button></nav>`
    );

    focusActiveTab();
    runFrame();

    expect(document.activeElement?.id).toBe("b");
  });
});
