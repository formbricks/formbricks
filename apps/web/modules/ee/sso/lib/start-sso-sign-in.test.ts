import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { startSsoSignIn } from "./start-sso-sign-in";

const { signInSocial } = vi.hoisted(() => ({ signInSocial: vi.fn() }));

vi.mock("@/modules/auth/lib/auth-client", () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));

const storage = { setItem: vi.fn() };
const params = {
  provider: "github",
  callbackURL: "/?source=signin",
  errorMessage: "Something went wrong",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startSsoSignIn", () => {
  test("shows the error and reports failure when the request never reaches the server", async () => {
    signInSocial.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(startSsoSignIn(params)).resolves.toBe(false);

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });

  test("shows the error and reports failure when the server answers with an error", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });

    await expect(startSsoSignIn(params)).resolves.toBe(false);

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });

  test("does not mark the provider as last used when the sign-in fails", async () => {
    signInSocial.mockResolvedValue({ data: null, error: { status: 500, message: "Internal Server Error" } });

    await startSsoSignIn(params);

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("marks the provider as last used, with the label the SSO options compare against", async () => {
    signInSocial.mockResolvedValue({ data: { url: "https://idp.example.com", redirect: true }, error: null });

    await expect(startSsoSignIn(params)).resolves.toBe(true);

    expect(storage.setItem).toHaveBeenCalledWith(FORMBRICKS_LOGGED_IN_WITH_LS, "Github");
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/?source=signin",
      errorCallbackURL: "/auth/login",
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("still reports a started sign-in when the browser denies storage", async () => {
    signInSocial.mockResolvedValue({ data: { url: "https://idp.example.com", redirect: true }, error: null });
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException("denied", "SecurityError");
    });

    await expect(startSsoSignIn(params)).resolves.toBe(true);

    expect(toast.error).not.toHaveBeenCalled();
  });

  test("lets an unexpected error propagate instead of hiding it behind the toast", async () => {
    signInSocial.mockRejectedValue(new RangeError("bug"));

    await expect(startSsoSignIn(params)).rejects.toThrow("bug");

    expect(toast.error).not.toHaveBeenCalled();
  });
});
