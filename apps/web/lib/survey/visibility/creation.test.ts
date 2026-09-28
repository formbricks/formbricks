import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveSurveyCreationFacts } from "./creation";
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
      { ownerId: "user-1", visibility: "private" },
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
});
