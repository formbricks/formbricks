// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { SurveyContainer } from "./survey-container";

describe("SurveyContainer", () => {
  afterEach(() => {
    cleanup();
  });

  test("marks modal surveys as labelled modal dialogs", () => {
    render(
      <SurveyContainer mode="modal">
        <button>Start</button>
      </SurveyContainer>
    );

    const dialog = screen.getByRole("dialog", { name: "Dialog" });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  test("does not add dialog semantics to inline surveys", () => {
    render(
      <SurveyContainer mode="inline">
        <button>Start</button>
      </SurveyContainer>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("wires the modal dialog to the survey content", () => {
    render(
      <SurveyContainer mode="modal">
        <button>Start</button>
      </SurveyContainer>
    );

    const dialog = screen.getByRole("dialog", { name: "Dialog" });

    expect(dialog.contains(screen.getByRole("button", { name: "Start" }))).toBe(true);
  });
});
