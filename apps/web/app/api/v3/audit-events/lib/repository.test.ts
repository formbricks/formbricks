import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { listAuditEventRows } from "./repository";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $queryRaw: vi.fn() } }));

/** The statement the mocked `$queryRaw` call would have sent, flattened so a test can read SQL and values. */
const lastStatement = () => {
  const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls.at(-1) as unknown as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.text.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg11111111111111111111";
const base = { limit: 20, cursor: null } as const;

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
});

describe("listAuditEventRows", () => {
  test("scopes to the organization even with no filter, newest first, one row past the limit", async () => {
    await listAuditEventRows({ organizationId: ORG_ID, query: base });

    const { text, values } = lastStatement();
    expect(text).toContain('WHERE a."organizationId" = $1 ORDER BY a."timestamp" DESC, a."id" DESC LIMIT $2');
    expect(values).toEqual([ORG_ID, 21]);
  });

  test("selects the summary columns only: never the diff, the address or the user agent", async () => {
    await listAuditEventRows({ organizationId: ORG_ID, query: base });

    const { text } = lastStatement();
    expect(text).not.toMatch(/changes|ipAddress|userAgent/);
  });

  test("binds every filter as a parameter, after the organization clause", async () => {
    const from = new Date("2030-01-01T00:00:00Z");
    const to = new Date("2030-02-01T00:00:00Z");

    await listAuditEventRows({
      organizationId: ORG_ID,
      query: {
        ...base,
        actorId: "user_9",
        actorType: "api",
        action: "deleted",
        targetType: "survey",
        targetId: "survey_9",
        status: "failure",
        from,
        to,
      },
    });

    const { text, values } = lastStatement();
    expect(text).toContain(
      'a."organizationId" = $1 AND a."actorId" = $2 AND a."actorType" = $3 AND a."action" = $4 AND a."targetType" = $5 AND a."targetId" = $6 AND a."status" = $7 AND a."timestamp" >= $8 AND a."timestamp" < $9'
    );
    expect(values).toEqual([
      ORG_ID,
      "user_9",
      "api",
      "deleted",
      "survey",
      "survey_9",
      "failure",
      from,
      to,
      21,
    ]);
  });

  test("never puts a filter value into the SQL text", async () => {
    await listAuditEventRows({
      organizationId: ORG_ID,
      query: { ...base, actorId: `x" OR "organizationId" <> '${ORG_ID}` },
    });

    const { text } = lastStatement();
    expect(text).not.toContain("<>");
    expect(text).not.toContain('x"');
  });

  test("resumes with a row-constructor comparison on (timestamp, id), the organization clause still first", async () => {
    await listAuditEventRows({
      organizationId: ORG_ID,
      query: {
        ...base,
        cursor: {
          version: 1,
          kind: "audit-events",
          sortBy: "-timestamp",
          fp: "0123456789abcdef",
          value: "2030-01-02T00:00:00.000Z",
          id: "cleventbbbbbbbbbbbbbbbbbb",
        },
      },
    });

    const { text, values } = lastStatement();
    expect(text).toContain('a."organizationId" = $1 AND (a."timestamp", a."id") < ($2, $3)');
    expect(values).toEqual([ORG_ID, new Date("2030-01-02T00:00:00.000Z"), "cleventbbbbbbbbbbbbbbbbbb", 21]);
  });
});
