import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import EmailChangeWithoutVerificationSuccessPage from "./page";

vi.mock("@/modules/auth/email-change-without-verification-success/page", () => ({
  EmailChangeWithoutVerificationSuccessPage: ({ children }) => (
    <div data-testid="email-change-success-page">{children}</div>
  ),
}));

describe("EmailChangeWithoutVerificationSuccessPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders EmailChangeWithoutVerificationSuccessPage", () => {
    const { getByTestId } = render(<EmailChangeWithoutVerificationSuccessPage />);
    expect(getByTestId("email-change-success-page")).toBeInTheDocument();
  });
});
