import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getSurveyVisibilityGates } from "@/lib/survey/visibility/gates";
import { getSurveyVisibilityUiGate, getSurveyVisibilityViewer, isSurveyVisibilityEnforced } from "./gate";

vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/survey/visibility/gates", () => ({ getSurveyVisibilityGates: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));

const on = { entitled: true, ready: true } as const;

const survey = (
  visibility: "restricted" | "workspace",
  ownerId: string | null = "owner",
  { visibilityVersion = 1, visibilityProjectedVersion = 1 } = {}
) => ({
  ownerId,
  visibility,
  visibilityProjectedVersion,
  visibilityVersion,
});

const admin = { enforced: true, isOrganizationAdmin: true, kind: "user", userId: "admin" } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSurveyVisibilityUiGate", () => {
  // Display and enforcement follow readiness alone; losing the entitlement only takes the controls
  // that change visibility away, because it never releases a restricted survey (Decision 6).
  test.each([
    [
      { entitled: true, ready: true },
      { enforced: true, manageable: true },
    ],
    [
      { entitled: false, ready: true },
      { enforced: true, manageable: false },
    ],
    [
      { entitled: false, ready: false },
      { enforced: false, manageable: false },
    ],
  ])("gates %o → %o", async (gates, expected) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(gates);
    await expect(getSurveyVisibilityUiGate("org")).resolves.toEqual(expected);
    expect(getSurveyVisibilityGates).toHaveBeenCalledWith("org");
  });
});

describe("isSurveyVisibilityEnforced", () => {
  test.each([true, false])("follows the readiness marker alone (%s)", async (ready) => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(ready);
    await expect(isSurveyVisibilityEnforced()).resolves.toBe(ready);
  });
});

describe("getSurveyVisibilityViewer", () => {
  test("not enforced: answers without resolving the actor or the owner, exactly as before", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: false, ready: false });

    await expect(getSurveyVisibilityViewer(survey("restricted"), "admin", "org")).resolves.toEqual({
      surveyVisibilityGate: { enforced: false, manageable: false },
      visibility: "workspace",
      pendingVisibility: null,
      surveyAccess: null,
      ownerName: null,
    });
    expect(resolveSurveyActorContext).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("enforced but no longer entitled: still describes the survey, without the right to change it", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: false, ready: true });
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Ada" } as never);

    await expect(getSurveyVisibilityViewer(survey("restricted"), "admin", "org")).resolves.toEqual({
      surveyVisibilityGate: { enforced: true, manageable: false },
      visibility: "restricted",
      pendingVisibility: null,
      surveyAccess: { canManageVisibility: false, via: "organizationRole" },
      ownerName: "Ada",
    });
  });

  test("gate on: derives access for the user and looks up the owner's name", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(on);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Ada" } as never);

    await expect(getSurveyVisibilityViewer(survey("restricted"), "admin", "org")).resolves.toEqual({
      surveyVisibilityGate: { enforced: true, manageable: true },
      visibility: "restricted",
      pendingVisibility: null,
      surveyAccess: { canManageVisibility: true, via: "organizationRole" },
      ownerName: "Ada",
    });
    expect(resolveSurveyActorContext).toHaveBeenCalledWith({ id: "admin", type: "user" }, "org");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "owner" }, select: { name: true } });
  });

  test("gate on, author gone: no owner lookup and a null name", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(on);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);

    const viewer = await getSurveyVisibilityViewer(survey("workspace", null), "admin", "org");

    expect(viewer).toEqual({
      surveyVisibilityGate: { enforced: true, manageable: true },
      visibility: "workspace",
      pendingVisibility: null,
      surveyAccess: { canManageVisibility: true, via: "workspace" },
      ownerName: null,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  // During a pending change the stored flag already holds the new value, but what is enforced does
  // not: the page reads the effective one, so a pending grant still shows (and blocks) as restricted.
  test.each([
    ["a pending grant", "workspace" as const, "workspace" as const],
    ["a pending restriction", "restricted" as const, "restricted" as const],
  ])("%s reports restricted as effective and names what it settles to", async (_label, stored, pending) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(on);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Ada" } as never);

    const viewer = await getSurveyVisibilityViewer(
      survey(stored, "owner", { visibilityVersion: 2, visibilityProjectedVersion: 1 }),
      "admin",
      "org"
    );

    expect(viewer.visibility).toBe("restricted");
    expect(viewer.pendingVisibility).toBe(pending);
    expect(viewer.surveyAccess).toEqual({ canManageVisibility: true, via: "organizationRole" });
  });

  // A survey whose first projection was never acknowledged enforces its stored value (policy.ts): a
  // just-created workspace survey is not held back as restricted while the outbox drains.
  test("a never-projected workspace survey is effectively workspace-visible", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(on);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);

    const viewer = await getSurveyVisibilityViewer(
      survey("workspace", "owner", { visibilityVersion: 0, visibilityProjectedVersion: -1 }),
      "admin",
      "org"
    );

    expect(viewer.visibility).toBe("workspace");
  });
});
