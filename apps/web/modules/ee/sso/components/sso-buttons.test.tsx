import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { AzureButton } from "./azure-button";
import { GithubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { OpenIdButton } from "./open-id-button";
import { SamlButton } from "./saml-button";

const { signInSocial, doesSamlConnectionExist } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  doesSamlConnectionExist: vi.fn(),
}));

vi.mock("@/modules/auth/lib/auth-client", () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));
vi.mock("@/modules/ee/sso/actions", () => ({
  doesSamlConnectionExistAction: () => doesSamlConnectionExist(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const buttons = [
  { name: "Google", label: "auth.continue_with_google", render: () => <GoogleButton source="signin" /> },
  { name: "GitHub", label: "auth.continue_with_github", render: () => <GithubButton source="signin" /> },
  { name: "Azure", label: "auth.continue_with_azure", render: () => <AzureButton source="signin" /> },
  { name: "OpenID", label: "auth.continue_with_openid", render: () => <OpenIdButton source="signin" /> },
  { name: "SAML", label: "auth.continue_with_saml", render: () => <SamlButton source="signin" /> },
];

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  doesSamlConnectionExist.mockResolvedValue({ data: true });
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
});

const clickButton = (label: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

describe.each(buttons)("$name SSO button", ({ label, render: renderButton }) => {
  test("shows an error when the sign-in request fails to reach the server, instead of rejecting unhandled", async () => {
    signInSocial.mockRejectedValue(new TypeError("Failed to fetch"));
    render(renderButton());

    clickButton(label);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong"));
    // Give a would-be unhandled rejection a chance to surface before asserting there was none.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  });

  test("shows an error when the server answers with an error", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    render(renderButton());

    clickButton(label);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong"));
  });

  test("does not mark the provider as last used when the sign-in fails", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });
    render(renderButton());

    clickButton(label);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS)).toBeNull();
  });

  test("marks the provider as last used and shows no error when the sign-in starts", async () => {
    signInSocial.mockResolvedValue({ data: { url: "https://idp.example.com", redirect: true }, error: null });
    render(renderButton());

    clickButton(label);

    await waitFor(() => expect(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS)).not.toBeNull());
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("SAML SSO button loading state", () => {
  test("stops loading after a failed sign-in, so the user can try again", async () => {
    signInSocial.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SamlButton source="signin" />);
    const button = screen.getByRole("button", { name: /auth.continue_with_saml/ });

    fireEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
