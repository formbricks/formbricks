import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSession } from "@/modules/auth/lib/session";
import { SsoRecoveryError, getSsoRecoveryConfirmation } from "@/modules/ee/sso/lib/sso-recovery";
import { SsoRecoveryConfirmPage } from "./page";

const cookieValues = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "http://localhost:3000",
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(
    async () => (key: string, params?: Record<string, string>) =>
      params ? `${key} ${JSON.stringify(params)}` : key
  ),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));

// The guards and the redirect mapping are tested in sso-recovery.test.ts; this file pins what the page
// does with their answer. The mapping stays real so a refusal lands where the route would send it.
vi.mock("@/modules/ee/sso/lib/sso-recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/sso/lib/sso-recovery")>()),
  getSsoRecoveryConfirmation: vi.fn(),
}));

const PROOF_COOKIE = "formbricks.sso_recovery_proof";

/** Every element in a not-yet-rendered tree, depth first. */
const elementsOf = (node: ReactNode): ReactElement[] => {
  if (Array.isArray(node)) return node.flatMap(elementsOf);
  if (!isValidElement(node)) return [];
  const { children } = node.props as { children?: ReactNode };
  return [node, ...elementsOf(children)];
};

const renderPage = (state?: string) =>
  SsoRecoveryConfirmPage({ searchParams: Promise.resolve(state === undefined ? {} : { state }) });

describe("SsoRecoveryConfirmPage (ENG-7395)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValues.clear();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user_1" } } as never);
  });

  test("asks before linking: a form that POSTs the state back to the completion route", async () => {
    cookieValues.set(PROOF_COOKIE, "proof-value");
    vi.mocked(getSsoRecoveryConfirmation).mockResolvedValue({ provider: "google" });

    const elements = elementsOf(await renderPage("state-id"));

    expect(getSsoRecoveryConfirmation).toHaveBeenCalledWith({
      stateId: "state-id",
      recoveryProof: "proof-value",
      sessionUserId: "user_1",
    });
    const form = elements.find((element) => element.type === "form");
    expect(form?.props).toMatchObject({
      method: "post",
      action: "http://localhost:3000/api/auth/sso/recovery/complete",
    });
    const stateInput = elements.find(
      (element) => element.type === "input" && (element.props as { name?: string }).name === "state"
    );
    expect(stateInput?.props).toMatchObject({ type: "hidden", value: "state-id" });
    // The provider is named in the copy, so the reader knows exactly what they would be linking.
    const text = elements
      .map((element) => (element.props as { children?: unknown }).children)
      .filter((children): children is string => typeof children === "string");
    expect(text).toContain('auth.sso_recovery_confirm.title {"provider":"Google"}');
    expect(text).toContain('auth.sso_recovery_confirm.warning {"provider":"Google"}');
  });

  test("shows nothing to a browser that never opened the emailed link", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockRejectedValue(new SsoRecoveryError("unproven"));

    await expect(renderPage("state-id")).rejects.toThrow(
      "NEXT_REDIRECT http://localhost:3000/auth/login?error=sso_recovery_link_not_opened"
    );
  });

  test("sends any other refusal to the ordinary failure page", async () => {
    vi.mocked(getSsoRecoveryConfirmation).mockRejectedValue(new SsoRecoveryError("rejected"));

    await expect(renderPage("state-id")).rejects.toThrow("error=OAuthAccountNotLinked");
  });

  test("refuses without a state, before reading anything", async () => {
    await expect(renderPage()).rejects.toThrow("error=OAuthAccountNotLinked");
    expect(getSsoRecoveryConfirmation).not.toHaveBeenCalled();
  });
});
