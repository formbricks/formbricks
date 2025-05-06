import { SettingsTitle } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

describe("SettingsTitle", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the title correctly", () => {
    const titleText = "My Awesome Settings";
    render(<SettingsTitle title={titleText} />);
    const headingElement = screen.getByRole("heading", { name: titleText, level: 2 });
    expect(headingElement).toBeInTheDocument();
    expect(headingElement).toHaveTextContent(titleText);
    expect(headingElement).toHaveClass("my-4 text-2xl font-medium leading-6 text-slate-800");
  });

  test("renders with an empty title", () => {
    render(<SettingsTitle title="" />);
    const headingElement = screen.getByRole("heading", { level: 2 });
    expect(headingElement).toBeInTheDocument();
    expect(headingElement).toHaveTextContent("");
  });
});
