import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { resolveV3VisibleSurveyWhere } from "@/app/api/v3/surveys/visibility-context";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { listV3Segments } from "./operations";

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@formbricks/database", () => ({
  prisma: { segment: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/app/api/v3/surveys/visibility-context", () => ({ resolveV3VisibleSurveyWhere: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));

const workspaceId = "clws0000000000000000000001";
const organizationId = "clorg000000000000000000001";
const visibleSurveyWhere = { visibility: "workspace" };

const segmentRow = (id: string, title: string, updatedAt: string) => ({
  id,
  title,
  description: "VIPs",
  isPrivate: false,
  filters: [],
  workspaceId,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date(updatedAt),
  surveys: [
    { id: "clsv0000000000000000000001", name: "Live", status: "inProgress" },
    { id: "clsv0000000000000000000002", name: "Done", status: "completed" },
  ],
});

const call = (entries: [string, string][] = []) =>
  listV3Segments({
    searchParams: new URLSearchParams([["workspaceId", workspaceId], ...entries]),
    authentication: null,
    requestId: "req_1",
    instance: "/api/v3/segments",
  });

describe("listV3Segments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId } as Awaited<
      ReturnType<typeof requireV3WorkspaceAccess>
    >);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(resolveV3VisibleSurveyWhere).mockResolvedValue(visibleSurveyWhere as never);
    vi.mocked(prisma.segment.count).mockResolvedValue(2);
  });

  test("excludes private segments, scopes survey refs by visibility, and serializes the table shape", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([
      segmentRow("clsg0000000000000000000002", "Beta", "2026-03-01T00:00:00.000Z"),
      segmentRow("clsg0000000000000000000001", "Alpha", "2026-02-01T00:00:00.000Z"),
    ] as never);

    const response = await call([
      ["limit", "1"],
      ["search", "50%"],
    ]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([
      {
        id: "clsg0000000000000000000002",
        title: "Beta",
        description: "VIPs",
        isPrivate: false,
        filters: [],
        workspaceId,
        surveys: ["clsv0000000000000000000001", "clsv0000000000000000000002"],
        activeSurveys: [{ id: "clsv0000000000000000000001", name: "Live" }],
        inactiveSurveys: [{ id: "clsv0000000000000000000002", name: "Done" }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    expect(body.meta).toEqual({ limit: 1, nextCursor: expect.any(String), totalCount: 2 });

    const args = vi.mocked(prisma.segment.findMany).mock.calls[0][0];
    const where = {
      workspaceId,
      isPrivate: false,
      title: { contains: String.raw`50\%`, mode: "insensitive" },
    };
    expect(args?.where).toEqual(where);
    expect(args?.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
    expect(args?.take).toBe(2);
    expect((args?.select as { surveys: { where: unknown } }).surveys.where).toBe(visibleSurveyWhere);
    expect(resolveV3VisibleSurveyWhere).toHaveBeenCalledWith(null, organizationId);
    expect(prisma.segment.count).toHaveBeenCalledWith({ where });
  });

  test("pages by title with a keyset on (title, id)", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([
      segmentRow("clsg0000000000000000000001", "Alpha", "2026-02-01T00:00:00.000Z"),
      segmentRow("clsg0000000000000000000002", "Beta", "2026-03-01T00:00:00.000Z"),
    ] as never);
    const first = await (
      await call([
        ["sortBy", "name"],
        ["limit", "1"],
      ])
    ).json();
    expect(vi.mocked(prisma.segment.findMany).mock.calls[0][0]?.orderBy).toEqual([
      { title: "asc" },
      { id: "asc" },
    ]);

    vi.mocked(prisma.segment.findMany).mockClear();
    vi.mocked(prisma.segment.findMany).mockResolvedValue([] as never);
    await call([
      ["sortBy", "name"],
      ["limit", "1"],
      ["cursor", first.meta.nextCursor],
    ]);

    expect(vi.mocked(prisma.segment.findMany).mock.calls[0][0]?.where).toEqual({
      AND: [
        { workspaceId, isPrivate: false },
        { OR: [{ title: { gt: "Alpha" } }, { title: "Alpha", id: { gt: "clsg0000000000000000000001" } }] },
      ],
    });
  });

  test("skips the count when includeTotalCount=false", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValue([] as never);
    const body = await (await call([["includeTotalCount", "false"]])).json();
    expect(body.meta).toEqual({ limit: 50, nextCursor: null, totalCount: null });
    expect(prisma.segment.count).not.toHaveBeenCalled();
  });

  test("403 without the Contacts entitlement, before reading segments", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);
    expect((await call()).status).toBe(403);
    expect(prisma.segment.findMany).not.toHaveBeenCalled();
  });

  test("returns the auth response untouched when access is denied", async () => {
    const denied = new Response(null, { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);
    expect(await call()).toBe(denied);
  });

  test("400 on an unknown parameter, before authorization", async () => {
    expect((await call([["isPrivate", "true"]])).status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });
});
