import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { SettingsId } from "./index";

describe("SettingsId", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the title and id correctly", () => {
    render(<SettingsId title="Survey ID" id="survey-123" />);

    const element = screen.getByText(/Survey ID: survey-123/);
    expect(element).toBeInTheDocument();
    expect(element.tagName.toLowerCase()).toBe("p");
  });

  test("applies correct styling", () => {
    render(<SettingsId title="Environment ID" id="env-456" />);

    const element = screen.getByText(/Environment ID: env-456/);
    expect(element).toHaveClass("py-1");
    expect(element).toHaveClass("text-xs");
    expect(element).toHaveClass("text-slate-400");
  });

  test("renders with very long id", () => {
    const longId = "a".repeat(100);
    render(<SettingsId title="API Key" id={longId} />);

    const element = screen.getByText(`API Key: ${longId}`);
    expect(element).toBeInTheDocument();
  });
});
