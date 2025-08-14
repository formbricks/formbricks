import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PageContentWrapper } from "./index";

describe("PageContentWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders children correctly", () => {
    const { getByText } = render(
      <PageContentWrapper>
        <div>Test Content</div>
      </PageContentWrapper>
    );

    expect(getByText("Test Content")).toBeInTheDocument();
  });
});
