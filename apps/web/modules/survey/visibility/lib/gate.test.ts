import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getSurveyVisibilityGates } from "@/lib/survey/visibility/gates";
import { getSurveyVisibilityUiGate, getSurveyVisibilityViewer } from "./gate";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/survey/visibility/gates", () => ({ getSurveyVisibilityGates: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));

const on = { entitled: true, ready: true } as const;

const survey = (visibility: "restricted" | "workspace", ownerId: string | null = "owner") => ({
  ownerId,
  visibility,
  visibilityProjectedVersion: 1,
  visibilityVersion: 1,
});

const admin = { enforced: true, isOrganizationAdmin: true, kind: "user", userId: "admin" } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSurveyVisibilityUiGate", () => {
  test.each([
    [{ entitled: true, ready: true }, true],
    [{ entitled: false, ready: true }, false],
    [{ entitled: false, ready: false }, false],
  ])("gates %o → %s", async (gates, expected) => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(gates);
    await expect(getSurveyVisibilityUiGate("org")).resolves.toBe(expected);
    expect(getSurveyVisibilityGates).toHaveBeenCalledWith("org");
  });
});

describe("getSurveyVisibilityViewer", () => {
  test("gate off: answers without resolving the actor or the owner", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue({ entitled: false, ready: true });

    await expect(getSurveyVisibilityViewer(survey("restricted"), "admin", "org")).resolves.toEqual({
      surveyVisibilityEnabled: false,
      surveyAccess: null,
      ownerName: null,
    });
    expect(resolveSurveyActorContext).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("gate on: derives access for the user and looks up the owner's name", async () => {
    vi.mocked(getSurveyVisibilityGates).mockResolvedValue(on);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(admin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Ada" } as never);

    await expect(getSurveyVisibilityViewer(survey("restricted"), "admin", "org")).resolves.toEqual({
      surveyVisibilityEnabled: true,
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
      surveyVisibilityEnabled: true,
      surveyAccess: { canManageVisibility: true, via: "workspace" },
      ownerName: null,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
