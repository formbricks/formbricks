import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SurveysPage, { metadata as layoutMetadata } from "./page";

vi.mock("@/modules/survey/list/page", () => ({
  SurveysPage: ({ children }) => <div data-testid="surveys-page">{children}</div>,
  metadata: { title: "Mocked Surveys Page" },
}));

describe("SurveysPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders SurveysPage", () => {
    const { getByTestId } = render(<SurveysPage params={undefined as any} searchParams={undefined as any} />);
    expect(getByTestId("surveys-page")).toBeInTheDocument();
    expect(getByTestId("surveys-page")).toHaveTextContent("");
  });

  test("exports metadata from @/modules/survey/list/page", () => {
    expect(layoutMetadata).toEqual({ title: "Mocked Surveys Page" });
  });
});
