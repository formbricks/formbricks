import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

// Mock the APIKeysPage component
vi.mock("@/modules/organization/settings/api-keys/page", () => ({
  APIKeysPage: () => <div data-testid="mocked-api-keys-page">APIKeysPage Content</div>,
}));

describe("APIKeys Page", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the APIKeysPage component", () => {
    render(<Page />);
    const apiKeysPageComponent = screen.getByTestId("mocked-api-keys-page");
    expect(apiKeysPageComponent).toBeInTheDocument();
    expect(apiKeysPageComponent).toHaveTextContent("APIKeysPage Content");
  });
});
