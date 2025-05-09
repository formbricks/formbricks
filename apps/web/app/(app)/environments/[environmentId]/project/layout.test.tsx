import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ProjectLayout, { metadata as layoutMetadata } from "./layout";

vi.mock("@/modules/projects/settings/layout", () => ({
  ProjectSettingsLayout: ({ children }) => <div data-testid="project-settings-layout">{children}</div>,
  metadata: { title: "Mocked Project Settings" },
}));

describe("ProjectLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders ProjectSettingsLayout", () => {
    const { getByTestId } = render(<ProjectLayout>Child Content</ProjectLayout>);
    expect(getByTestId("project-settings-layout")).toBeInTheDocument();
    expect(getByTestId("project-settings-layout")).toHaveTextContent("Child Content");
  });

  test("exports metadata from @/modules/projects/settings/layout", () => {
    expect(layoutMetadata).toEqual({ title: "Mocked Project Settings" });
  });
});
