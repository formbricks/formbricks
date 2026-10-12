import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import {
  assertNewlyAttachedSurveysWorkspaceVisible,
  findNewlyAttachedNotWorkspaceVisibleSurveyIds,
  findNotWorkspaceVisibleSurveyIds,
  isSurveyOutboundAllowed,
} from "./outbound";

const readiness = vi.hoisted(() => ({ ready: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: async () => readiness.ready }));
vi.mock("@formbricks/database", () => ({ prisma: { survey: { findMany: vi.fn() } } }));

const settled = { visibilityProjectedVersion: 2, visibilityVersion: 2 };

beforeEach(() => {
  vi.mocked(prisma.survey.findMany).mockReset();
  readiness.ready = true;
});

describe("isSurveyOutboundAllowed", () => {
  test.each([
    ["a settled workspace-visible survey", { ...settled, visibility: "workspace" as const }, true],
    ["a restricted survey", { ...settled, visibility: "restricted" as const }, false],
    [
      "a pending grant (still restricted until the graph holds it)",
      { visibility: "workspace" as const, visibilityProjectedVersion: 2, visibilityVersion: 3 },
      false,
    ],
    [
      "a just-created workspace survey, in its initial projection",
      { visibility: "workspace" as const, visibilityProjectedVersion: -1, visibilityVersion: 0 },
      true,
    ],
    [
      "a grant made before the first acknowledgement (still pending)",
      { visibility: "workspace" as const, visibilityProjectedVersion: -1, visibilityVersion: 2 },
      false,
    ],
    [
      "a just-created restricted survey, in its initial projection",
      { visibility: "restricted" as const, visibilityProjectedVersion: -1, visibilityVersion: 0 },
      false,
    ],
  ])("%s", (_label, row, expected) => {
    expect(isSurveyOutboundAllowed(row, true)).toBe(expected);
  });

  test("allows everything while visibility is not enforced", () => {
    expect(isSurveyOutboundAllowed({ ...settled, visibility: "restricted" }, false)).toBe(true);
  });
});

describe("findNotWorkspaceVisibleSurveyIds", () => {
  test("queries restricted and pending surveys among the given ids, once each", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([{ id: "s2" }] as never);

    await expect(findNotWorkspaceVisibleSurveyIds(["s1", "s2", "s1"])).resolves.toEqual(["s2"]);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["s1", "s2"] },
        OR: [
          { visibility: "restricted" },
          { visibilityPending: true, NOT: { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } } },
        ],
      },
      select: { id: true },
    });
  });

  test("makes no query while enforcement is off or for no ids", async () => {
    readiness.ready = false;
    await expect(findNotWorkspaceVisibleSurveyIds(["s1"])).resolves.toEqual([]);
    readiness.ready = true;
    await expect(findNotWorkspaceVisibleSurveyIds([])).resolves.toEqual([]);
    expect(prisma.survey.findMany).not.toHaveBeenCalled();
  });
});

describe("newly attached surveys", () => {
  test("only checks surveys the connection did not already have", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    await findNewlyAttachedNotWorkspaceVisibleSurveyIds(["kept", "added"], ["kept"]);

    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]?.where?.id).toEqual({ in: ["added"] });
  });

  test("refuses the server action with the outbound-block copy", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([{ id: "added" }] as never);

    await expect(assertNewlyAttachedSurveysWorkspaceVisible(["added"])).rejects.toBeInstanceOf(
      OperationNotAllowedError
    );
  });
});
