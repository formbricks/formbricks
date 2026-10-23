import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { recordSurveyListPredicateMismatch } from "@/lib/authorization/metrics";
import { filterReadableSurveyIds, lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import {
  confirmReadableRetentionExemptions,
  resolveRetentionExemptionReadScope,
} from "./exemption-read-scope";
import type { TRetentionExemptionRow } from "./exemptions-service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/metrics", () => ({ recordSurveyListPredicateMismatch: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({
  filterReadableSurveyIds: vi.fn(),
  lookupAuthorizedWorkspaceIds: vi.fn(),
}));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const ACTOR = { type: "user", id: USER_ID };
const MEMBER_CONTEXT = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: USER_ID } as const;

describe("resolveRetentionExemptionReadScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  });

  test("gives owners and managers the whole organisation, without looking up workspaces", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(resolveRetentionExemptionReadScope(USER_ID, ORG_ID)).resolves.toEqual({
      kind: "organization",
    });
    expect(can).toHaveBeenCalledWith(ACTOR, "organization.manage", { type: "organization", id: ORG_ID });
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });

  test("limits anyone else to their workspaces and the surveys visible to them", async () => {
    vi.mocked(can).mockResolvedValue(false);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["clwsp11111111111111111111"]);

    await expect(resolveRetentionExemptionReadScope(USER_ID, ORG_ID)).resolves.toEqual({
      kind: "surveys",
      workspaceIds: ["clwsp11111111111111111111"],
      actorContext: MEMBER_CONTEXT,
    });
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(ACTOR);
    expect(can).toHaveBeenCalledTimes(1);
  });

  test("carries visibility enforcement being off, which the SQL predicate then skips", async () => {
    vi.mocked(can).mockResolvedValue(false);
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(resolveRetentionExemptionReadScope(USER_ID, ORG_ID)).resolves.toMatchObject({
      actorContext: { enforced: false },
    });
  });
});

describe("confirmReadableRetentionExemptions", () => {
  const row = (id: string, surveyId: string, projected = true) =>
    ({
      id,
      surveyId,
      visibilityVersion: 2,
      visibilityProjectedVersion: projected ? 2 : 1,
    }) as TRetentionExemptionRow;
  const memberScope = { kind: "surveys", workspaceIds: ["clwsp"], actorContext: MEMBER_CONTEXT } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("drops and counts rows whose survey the graph denies, checking each settled survey once", async () => {
    const rows = [row("a", "s1"), row("b", "s2"), row("c", "s1"), row("d", "s3", false)];
    vi.mocked(filterReadableSurveyIds).mockResolvedValue(new Set(["s1"]));

    await expect(confirmReadableRetentionExemptions(USER_ID, memberScope, rows)).resolves.toEqual([
      rows[0],
      rows[2],
      rows[3],
    ]);
    expect(filterReadableSurveyIds).toHaveBeenCalledWith(ACTOR, ["s1", "s2"]);
    expect(recordSurveyListPredicateMismatch).toHaveBeenCalledWith(1);
  });

  test("keeps every row the graph confirms, without recording a mismatch", async () => {
    const rows = [row("a", "s1")];
    vi.mocked(filterReadableSurveyIds).mockResolvedValue(new Set(["s1"]));

    await expect(confirmReadableRetentionExemptions(USER_ID, memberScope, rows)).resolves.toBe(rows);
    expect(recordSurveyListPredicateMismatch).not.toHaveBeenCalled();
  });

  test.each([
    ["owners and managers", { kind: "organization" } as const],
    ["enforcement off", { ...memberScope, actorContext: { ...MEMBER_CONTEXT, enforced: false } }],
  ])("skips the graph for %s", async (_case, scope) => {
    const rows = [row("a", "s1")];

    await expect(confirmReadableRetentionExemptions(USER_ID, scope, rows)).resolves.toBe(rows);
    expect(filterReadableSurveyIds).not.toHaveBeenCalled();
  });
});
