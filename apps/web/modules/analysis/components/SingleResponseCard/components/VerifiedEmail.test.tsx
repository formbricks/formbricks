import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifiedEmail } from "./VerifiedEmail";

vi.mock("lucide-react", () => ({
  MailIcon: (props: any) => (
    <div data-testid="MailIcon" {...props}>
      MailIcon
    </div>
  ),
}));

describe("VerifiedEmail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders verified email text and value when provided", () => {
    render(<VerifiedEmail responseData={{ verifiedEmail: "test@example.com" }} />);
    expect(screen.getByText("common.verified_email")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("MailIcon")).toBeInTheDocument();
  });

  it("renders empty value when verifiedEmail is not a string", () => {
    render(<VerifiedEmail responseData={{ verifiedEmail: 123 }} />);
    expect(screen.getByText("common.verified_email")).toBeInTheDocument();
    const emptyParagraph = screen.getByText("", { selector: "p.ph-no-capture" });
    expect(emptyParagraph.textContent).toBe("");
  });
});
