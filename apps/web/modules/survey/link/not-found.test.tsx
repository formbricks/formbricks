import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LinkSurveyNotFound } from "./not-found";

// Mock the Image and Link components from Next.js
vi.mock("next/image", () => ({
  default: vi
    .fn()
    .mockImplementation(({ src, alt, className }) => (
      <img src={src} alt={alt} className={className} data-testid="mock-image" />
    )),
}));

vi.mock("next/link", () => ({
  default: vi.fn().mockImplementation(({ href, children }) => (
    <a href={href} data-testid="mock-link">
      {children}
    </a>
  )),
}));

vi.mock("lucide-react", () => ({
  HelpCircleIcon: () => <div data-testid="mock-help-circle-icon">HelpCircleIcon</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ className, children }) => (
    <button data-testid="mock-button" className={className}>
      {children}
    </button>
  ),
}));

vi.mock("./lib/footerlogo.svg", () => ({
  default: "mock-footer-logo.svg",
}));

describe("LinkSurveyNotFound", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the component correctly", () => {
    render(<LinkSurveyNotFound />);

    // Check the basic elements that are visible in the rendered output
    expect(screen.getByText("Survey not found.")).toBeInTheDocument();
    expect(screen.getByText("There is no survey with this ID.")).toBeInTheDocument();
  });
});
