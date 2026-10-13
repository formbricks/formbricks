import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { filterReadableSurveyIds, lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { AUTHZED_MAX_BULK_CHECK_ITEMS } from "@/lib/authzed/constants";
import { findEffectivelyRestrictedSurveyIds } from "@/lib/survey/visibility/outbound";
import { type TNoticeSurvey, resolveSurveyNoticeRecipients } from "./recipients";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { membership: { findMany: vi.fn() } } }));
vi.mock("@/lib/authorization/resource-list", () => ({
  filterReadableSurveyIds: vi.fn(),
  lookupAuthorizedWorkspaceIds: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/outbound", () => ({ findEffectivelyRestrictedSurveyIds: vi.fn() }));

/**
 * Recipients against a real database and the real survey read check (a restricted survey falls back to
 * an owner, a survey nobody can be told about is skipped as `noRecipient`) are proven in
 * `surveys-sweeper.integration.test.ts` and `responses-sweeper.integration.test.ts`, and the effective
 * visibility rule against real survey rows in `recipients.integration.test.ts`. These pin the order of
 * preference and how the read checks are batched.
 */
const ORG_ID = "clorg";

type TRole = "owner" | "manager" | "member";
const member = (id: string, role: TRole, locale = "de-DE") => ({
  role,
  user: { id, email: `${id}@example.com`, name: id.toUpperCase(), locale },
});
const recipient = (id: string, locale = "de-DE") => ({
  userId: id,
  email: `${id}@example.com`,
  name: id.toUpperCase(),
  locale,
});
const survey = (id: string, ownerId: string | null, createdBy: string | null = null): TNoticeSurvey => ({
  id,
  workspaceId: "clworkspace",
  ownerId,
  createdBy,
});

/** A read check that lets each user read the listed surveys. */
const readable = (grants: Record<string, string[]>) =>
  vi.fn(async (actor: { id: string }, surveyIds: ReadonlyArray<string>) => {
    const allowed = grants[actor.id] ?? [];
    return new Set(surveyIds.filter((surveyId) => allowed.includes(surveyId)));
  });

describe("resolveSurveyNoticeRecipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findEffectivelyRestrictedSurveyIds).mockResolvedValue([]);
  });

  test("reads nothing for no surveys", async () => {
    const canRead = readable({});

    await expect(resolveSurveyNoticeRecipients(ORG_ID, [], canRead)).resolves.toEqual(new Map());
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(canRead).not.toHaveBeenCalled();
  });

  test("tells the survey's owner, then its creator, then the organisation's first owner, before a manager", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      member("alice", "member"),
      member("bob", "member"),
      member("zed", "owner"),
      member("mia", "manager"),
      member("yan", "owner"),
    ] as never);
    const canRead = readable({ alice: ["s1"], bob: ["s2"] });

    const recipients = await resolveSurveyNoticeRecipients(
      ORG_ID,
      [survey("s1", "alice", "bob"), survey("s2", "alice", "bob"), survey("s3", "alice", "bob")],
      canRead
    );

    expect(recipients).toEqual(
      new Map([
        ["s1", recipient("alice")],
        // Alice owns s2 but can't read it (restricted): its creator is told.
        ["s2", recipient("bob")],
        // Neither can read s3: the organisation's owners come first, in a stable order.
        ["s3", recipient("yan")],
      ])
    );
    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        role: { not: "billing" },
        accepted: true,
        user: { isActive: true },
        OR: [{ userId: { in: ["alice", "bob"] } }, { role: { in: ["owner", "manager"] } }],
      },
      select: { role: true, user: { select: { id: true, email: true, name: true, locale: true } } },
    });
  });

  test("falls back to a manager when the organisation has no eligible owner, and skips a survey nobody can be told about", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([member("mia", "manager")] as never);

    const withManager = await resolveSurveyNoticeRecipients(ORG_ID, [survey("s1", null)], readable({}));
    expect(withManager).toEqual(new Map([["s1", recipient("mia")]]));

    vi.mocked(prisma.membership.findMany).mockResolvedValueOnce([member("alice", "member")] as never);
    const nobody = await resolveSurveyNoticeRecipients(ORG_ID, [survey("s1", "alice")], readable({}));
    expect(nobody.size).toBe(0);
  });

  test("checks only people who are still eligible members, one bulk call per person per chunk", async () => {
    // Gone is the owner of every survey but no longer an eligible member: never checked.
    vi.mocked(prisma.membership.findMany).mockResolvedValue([member("alice", "member")] as never);
    const surveys = Array.from({ length: AUTHZED_MAX_BULK_CHECK_ITEMS + 1 }, (_, index) =>
      survey(`s${index}`, "gone", "alice")
    );
    const canRead = readable({ alice: surveys.map((item) => item.id) });

    const recipients = await resolveSurveyNoticeRecipients(ORG_ID, surveys, canRead);

    expect(recipients.size).toBe(surveys.length);
    expect(canRead).toHaveBeenCalledTimes(2);
    expect(canRead.mock.calls.map(([actor, ids]) => [actor, ids.length])).toEqual([
      [{ type: "user", id: "alice" }, AUTHZED_MAX_BULK_CHECK_ITEMS],
      [{ type: "user", id: "alice" }, 1],
    ]);
  });

  test("emails in English when the stored locale isn't one the app supports", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([member("yan", "owner", "xx-XX")] as never);

    const recipients = await resolveSurveyNoticeRecipients(ORG_ID, [survey("s1", null)], readable({}));

    expect(recipients.get("s1")?.locale).toBe("en-US");
  });

  test("fails closed when a read check fails, rather than emailing a fallback", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      member("alice", "member"),
      member("yan", "owner"),
    ] as never);
    const failure = new Error("SpiceDB unavailable");

    await expect(
      resolveSurveyNoticeRecipients(ORG_ID, [survey("s1", "alice")], vi.fn().mockRejectedValue(failure))
    ).rejects.toBe(failure);
  });

  test("an effectively restricted survey passes over a creator the graph still lets read it, not its owner", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      member("alice", "member"),
      member("bob", "member"),
      member("yan", "owner"),
    ] as never);
    // The graph hasn't caught up with the restriction yet: it still lets both read every survey.
    const canRead = readable({ alice: ["s1", "s2"], bob: ["s1", "s2"] });
    vi.mocked(findEffectivelyRestrictedSurveyIds).mockResolvedValue(["s1", "s2"]);

    const recipients = await resolveSurveyNoticeRecipients(
      ORG_ID,
      [survey("s1", "alice", "bob"), survey("s2", null, "bob")],
      canRead
    );

    expect(recipients).toEqual(
      new Map([
        // The owner may read their own restricted survey.
        ["s1", recipient("alice")],
        // The creator may not: the organisation's owner is told instead.
        ["s2", recipient("yan")],
      ])
    );
    expect(findEffectivelyRestrictedSurveyIds).toHaveBeenCalledWith(["s1", "s2"]);
  });

  test("looks up no visibility when nobody needs a read check", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([member("yan", "owner")] as never);

    await resolveSurveyNoticeRecipients(ORG_ID, [survey("s1", null)], readable({}));

    expect(findEffectivelyRestrictedSurveyIds).not.toHaveBeenCalled();
  });

  test("by default, checks the workspace before the graph, which lets everything through until visibility is enforced", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      member("alice", "member"),
      member("yan", "owner"),
    ] as never);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-team"]);
    vi.mocked(filterReadableSurveyIds).mockImplementation(async (_actor, ids) => new Set(ids));
    const inWorkspace = (id: string, workspaceId: string) => ({
      ...survey(id, "alice", "alice"),
      workspaceId,
    });

    const recipients = await resolveSurveyNoticeRecipients(ORG_ID, [
      inWorkspace("s1", "ws-team"),
      inWorkspace("s2", "ws-other"),
    ]);

    expect(recipients).toEqual(
      new Map([
        ["s1", recipient("alice")],
        // Alice has no access to s2's workspace: the organisation's owner is told instead.
        ["s2", recipient("yan")],
      ])
    );
    // One workspace lookup per person; the graph only sees surveys in workspaces she can read.
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledTimes(1);
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith({ type: "user", id: "alice" });
    expect(filterReadableSurveyIds).toHaveBeenCalledWith({ type: "user", id: "alice" }, ["s1"]);
  });
});
