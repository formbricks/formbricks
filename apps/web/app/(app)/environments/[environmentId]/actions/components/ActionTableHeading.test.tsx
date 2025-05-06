import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ActionTableHeading } from "./ActionTableHeading";

// Mock the server-side translation function
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

describe("ActionTableHeading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the table heading with correct column names", async () => {
    // Render the async component
    const ResolvedComponent = await ActionTableHeading();
    render(ResolvedComponent);

    // Check if the translated column headers are present
    expect(screen.getByText("environments.actions.user_actions")).toBeInTheDocument();
    expect(screen.getByText("common.created")).toBeInTheDocument();
    // Check for the screen reader only text
    expect(screen.getByText("common.edit")).toBeInTheDocument();
  });
});
