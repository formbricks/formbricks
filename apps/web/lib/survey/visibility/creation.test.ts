import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  SurveyCreationVisibilityNotAllowedError,
  SurveyCreationVisibilityNotEnabledError,
  resolveSurveyCreationFacts,
} from "./creation";
import { getSurveyVisibilityGates } from "./gates";

vi.mock("./gates", () => ({ getSurveyVisibilityGates: vi.fn() }));

const user = { id: "user-1", type: "user" } as const;
const apiKey = { id: "key-1", type: "apiKey" } as const;

describe("resolveSurveyCreationFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    [
      { entitled: true, ready: true },
      { ownerId: "user-1", visibility: "restricted" },
    ],
    [
      { entitled: false, ready: true },
      { ownerId: "user-1", visibility: "workspace" },
    ],
    [
      { entitled: false, ready: false },
      { ownerId: "user-1", visibility: "workspace" },
    ],
  ] as const)("a signed-in user with gates %j creates %j", async (gates, expected) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(gates);

    await expect(resolveSurveyCreationFacts({ actor: user, organizationId: "org-1" })).resolves.toEqual(
      expected
    );
  });

  test("an API key always creates a workspace-visible survey with no owner", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: true, ready: true });

    await expect(resolveSurveyCreationFacts({ actor: apiKey, organizationId: "org-1" })).resolves.toEqual({
      ownerId: null,
      visibility: "workspace",
    });
    expect(getSurveyVisibilityGates).not.toHaveBeenCalled();
  });

  test("no principal at all creates the conservative default", async () => {
    await expect(resolveSurveyCreationFacts({ actor: null, organizationId: null })).resolves.toEqual({
      ownerId: null,
      visibility: "workspace",
    });
    expect(getSurveyVisibilityGates).not.toHaveBeenCalled();
  });

  // ENG-7508: an explicit choice on create. `workspace` is a decision that needs no gates, and it keeps
  // the owner — the fact a later restriction needs.
  test.each([
    ["a signed-in user", user, "org-1"],
    ["an API key", apiKey, "org-1"],
    ["no principal", null, null],
  ] as const)("%s asking for workspace needs no gates read", async (_label, actor, organizationId) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: true, ready: true });

    await expect(
      resolveSurveyCreationFacts({ actor, organizationId, requestedVisibility: "workspace" })
    ).resolves.toEqual({
      ownerId: actor?.type === "user" ? actor.id : null,
      visibility: "workspace",
    });
    expect(getSurveyVisibilityGates).not.toHaveBeenCalled();
  });

  test("a signed-in user asking for restricted with the gates on gets it", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: true, ready: true });

    await expect(
      resolveSurveyCreationFacts({ actor: user, organizationId: "org-1", requestedVisibility: "restricted" })
    ).resolves.toEqual({ ownerId: "user-1", visibility: "restricted" });
  });

  test.each([
    { entitled: false, ready: true },
    { entitled: false, ready: false },
    { entitled: true, ready: false },
  ] as const)("restricted is refused, never downgraded, when gates are %j", async (gates) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(gates);

    await expect(
      resolveSurveyCreationFacts({ actor: user, organizationId: "org-1", requestedVisibility: "restricted" })
    ).rejects.toBeInstanceOf(SurveyCreationVisibilityNotEnabledError);
  });

  test.each([
    ["an API key", apiKey, "org-1"],
    ["no principal", null, null],
  ] as const)("%s asking for restricted is refused as ownerless", async (_label, actor, organizationId) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: true, ready: true });

    await expect(
      resolveSurveyCreationFacts({ actor, organizationId, requestedVisibility: "restricted" })
    ).rejects.toBeInstanceOf(SurveyCreationVisibilityNotAllowedError);
    expect(getSurveyVisibilityGates).not.toHaveBeenCalled();
  });
});
