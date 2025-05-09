import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CardArrangementTabs } from "./index";

describe("CardArrangementTabs", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with the correct active arrangement", () => {
    const setActiveCardArrangement = vi.fn();

    render(
      <CardArrangementTabs
        surveyType="link"
        activeCardArrangement="straight"
        setActiveCardArrangement={setActiveCardArrangement}
      />
    );

    // Check that the options are rendered
    expect(screen.getByText("environments.surveys.edit.straight")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.casual")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.simple")).toBeInTheDocument();

    // Check that the straight radio is selected based on the input checked state
    const straightInput = screen.getByRole("radio", { name: "environments.surveys.edit.straight" });
    expect(straightInput).toBeInTheDocument();
    expect(straightInput).toBeChecked();
  });

  test("calls setActiveCardArrangement when a tab is clicked", async () => {
    const user = userEvent.setup();
    const setActiveCardArrangement = vi.fn();

    render(
      <CardArrangementTabs
        surveyType="app"
        activeCardArrangement="straight"
        setActiveCardArrangement={setActiveCardArrangement}
      />
    );

    // Click on the casual option
    const casualLabel = screen.getByText("environments.surveys.edit.casual");
    await user.click(casualLabel);

    expect(setActiveCardArrangement).toHaveBeenCalledWith("casual", "app");
  });

  test("does not call setActiveCardArrangement when disabled", async () => {
    const user = userEvent.setup();
    const setActiveCardArrangement = vi.fn();

    render(
      <CardArrangementTabs
        surveyType="link"
        activeCardArrangement="straight"
        setActiveCardArrangement={setActiveCardArrangement}
        disabled={true}
      />
    );

    // Click on the casual option
    const casualLabel = screen.getByText("environments.surveys.edit.casual");
    await user.click(casualLabel);

    expect(setActiveCardArrangement).not.toHaveBeenCalled();
  });

  test("displays icons for each arrangement option", () => {
    render(
      <CardArrangementTabs
        surveyType="link"
        activeCardArrangement="casual"
        setActiveCardArrangement={vi.fn()}
      />
    );

    // Check that all three options are rendered with their labels
    const casualLabel = screen.getByText("environments.surveys.edit.casual").closest("label");
    const straightLabel = screen.getByText("environments.surveys.edit.straight").closest("label");
    const simpleLabel = screen.getByText("environments.surveys.edit.simple").closest("label");

    // Each label should contain an SVG icon
    expect(casualLabel?.querySelector("svg")).toBeInTheDocument();
    expect(straightLabel?.querySelector("svg")).toBeInTheDocument();
    expect(simpleLabel?.querySelector("svg")).toBeInTheDocument();
  });
});
