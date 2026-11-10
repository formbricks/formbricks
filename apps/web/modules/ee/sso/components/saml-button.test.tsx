import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SamlButton } from "./saml-button";

const mocks = vi.hoisted(() => ({ signInSocial: vi.fn(), toastError: vi.fn() }));

vi.mock("@/modules/auth/lib/auth-client", () => ({ authClient: { signIn: { social: mocks.signInSocial } } }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.toastError } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signInSocial.mockResolvedValue({});
  vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SamlButton", () => {
  test("starts SAML sign-in when the page found the connection", async () => {
    render(<SamlButton source="signin" returnToUrl="/" connectionExists />);

    fireEvent.click(screen.getByRole("button", { name: /auth.continue_with_saml/ }));

    await waitFor(() =>
      expect(mocks.signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "saml", errorCallbackURL: "/auth/login" })
      )
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  test("explains the missing connection instead of starting sign-in", async () => {
    render(<SamlButton source="signup" returnToUrl="/" connectionExists={false} />);

    fireEvent.click(screen.getByRole("button", { name: /auth.continue_with_saml/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("auth.saml_connection_error"));
    expect(mocks.signInSocial).not.toHaveBeenCalled();
  });
});
