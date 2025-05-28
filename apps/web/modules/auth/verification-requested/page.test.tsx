import { getEmailFromEmailToken } from "@/lib/jwt";
import { VerificationRequestedPage } from "@/modules/auth/verification-requested/page";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/jwt", () => ({
  getEmailFromEmailToken: vi.fn(),
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/auth/verification-requested/components/request-verification-email", () => ({
  RequestVerificationEmail: ({ email }) => <div>Mocked RequestVerificationEmail: {email}</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
}));

vi.doMock("@/tolgee/server", async () => {
  const actual = await vi.importActual("@/tolgee/server");
  return {
    ...actual,
    getTranslate: vi.fn().mockResolvedValue(vi.fn((key) => key)),
    T: ({ keyName, params }) => (
      <>
        {keyName} {params && params.email && <span>{params.email}</span>}
      </>
    ),
  };
});

describe("VerificationRequestedPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the page with valid email", async () => {
    const mockEmail = "test@example.com";
    vi.mocked(getEmailFromEmailToken).mockReturnValue(mockEmail);

    const searchParams = { token: "valid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(
      screen.getByText("auth.verification-requested.please_confirm_your_email_address")
    ).toBeInTheDocument();
    expect(screen.getByText(/auth.verification-requested.we_sent_an_email_to/)).toBeInTheDocument();
    expect(screen.getByText(mockEmail)).toBeInTheDocument();
    expect(
      screen.getByText(
        "auth.verification-requested.please_click_the_link_in_the_email_to_activate_your_account"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.verification-requested.verification_email_successfully_sent_info")
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.verification-requested.you_didnt_receive_an_email_or_your_link_expired")
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Mocked RequestVerificationEmail: ${mockEmail.toLowerCase()}`)
    ).toBeInTheDocument();
  });

  test("renders invalid email message when email parsing fails", async () => {
    vi.mocked(getEmailFromEmailToken).mockReturnValue("invalid-email");

    const searchParams = { token: "valid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(screen.getByText("auth.verification-requested.invalid_email_address")).toBeInTheDocument();
  });

  test("renders invalid token message when token is invalid", async () => {
    vi.mocked(getEmailFromEmailToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const searchParams = { token: "invalid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(screen.getByText("auth.verification-requested.invalid_token")).toBeInTheDocument();
  });
});
