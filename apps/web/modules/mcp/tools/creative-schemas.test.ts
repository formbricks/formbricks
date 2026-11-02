import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  zCreateBannerCreativeRequest,
  zCreateFeedbackButtonCreativeRequest,
  zCreativeResource,
} from "@formbricks/api-v3-schemas";
import {
  ZMcpCreativeDeleteOutput,
  ZMcpCreativeListOutput,
  ZMcpCreativeOutput,
  ZMcpCreativeStatsOutput,
} from "./creative-output-schemas";
import {
  ZMcpCreateCreativeFields,
  ZMcpCreateCreativeInput,
  ZMcpGetCreativeStatsInput,
  ZMcpListCreativesInput,
} from "./creative-schemas";

vi.mock("server-only", () => ({}));

const workspaceId = "clxx1234567890123456789012";
const creativeId = "clcr1234567890123456789012";

const feedbackButtonBody = {
  workspaceId,
  name: "Feedback tab",
  type: "feedbackButton",
  content: { label: { "en-US": "Feedback" }, icon: null },
};
const bannerBody = {
  workspaceId,
  name: "Maintenance",
  type: "banner",
  content: {
    message: { "en-US": [{ text: "Down tonight." }] },
    button: null,
    dismissible: true,
    accessibleName: null,
  },
};

describe("create_creative input", () => {
  test("advertises the fields of both v3 create variants, no more and no fewer", () => {
    // The input is one flat object because a tool's root cannot be a union; this is what keeps that flat
    // object from drifting from the two variants the REST route is generated from.
    const variantFields = new Set([
      ...Object.keys(zCreateFeedbackButtonCreativeRequest.shape),
      ...Object.keys(zCreateBannerCreativeRequest.shape),
    ]);

    expect(Object.keys(ZMcpCreateCreativeFields.shape).toSorted()).toEqual([...variantFields].toSorted());
  });

  test("is advertised as a plain strict object, with no union at the root", () => {
    const advertised = z.toJSONSchema(ZMcpCreateCreativeInput, { io: "input" });

    expect(advertised).toMatchObject({ type: "object", additionalProperties: false });
    expect(advertised).not.toHaveProperty("oneOf");
    expect(advertised).not.toHaveProperty("anyOf");
    expect(advertised).not.toHaveProperty("allOf");
  });

  test.each([
    ["a feedback button", feedbackButtonBody],
    ["a banner", bannerBody],
  ])("accepts %s as the v3 create body does, defaults filled in", (_label, body) => {
    const parsed = ZMcpCreateCreativeInput.parse(body);

    expect(parsed).toMatchObject({ ...body, status: "draft", defaultLanguage: "en-US" });
  });

  test.each([
    ["a banner's content on a feedback button", { ...feedbackButtonBody, content: bannerBody.content }],
    ["a feedback button's content on a banner", { ...bannerBody, content: feedbackButtonBody.content }],
  ])("refuses %s, naming `content`", (_label, body) => {
    const result = ZMcpCreateCreativeInput.safeParse(body);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "content")).toBe(true);
  });

  test("takes theme colours per appearance, as the v3 contract does, and refuses the old plain string", () => {
    const withBackground = (backgroundColor: unknown) => ({
      ...feedbackButtonBody,
      styling: {
        position: { desktop: { edge: "right", offset: 50 }, phone: null },
        theme: {
          customStyles: true,
          backgroundColor,
          textColor: { light: "#ffffff" },
          borderColor: null,
          borderRadius: null,
          fontWeight: null,
          fontSize: { desktop: null, phone: null },
          paddingX: { desktop: null, phone: null },
          paddingY: { desktop: null, phone: null },
        },
      },
    });

    const parsed = ZMcpCreateCreativeInput.parse(withBackground({ light: "#112e51", dark: "#bfdbfe" }));
    expect(parsed.styling?.theme.backgroundColor).toEqual({ light: "#112e51", dark: "#bfdbfe" });

    const legacy = ZMcpCreateCreativeInput.safeParse(withBackground("#112e51"));
    expect(legacy.success).toBe(false);
    expect(legacy.error?.issues.some((issue) => issue.path[0] === "styling")).toBe(true);
    // The advertised JSON schema carries the same shape, so an agent is told to send it.
    expect(JSON.stringify(z.toJSONSchema(ZMcpCreateCreativeInput, { io: "input" }))).toContain('"dark"');
  });

  test("refuses an undeclared field", () => {
    expect(
      ZMcpCreateCreativeInput.safeParse({ ...feedbackButtonBody, displayStatus: "active" }).success
    ).toBe(false);
  });

  test("applies the v3 Show when rules the contract states in prose", () => {
    const result = ZMcpCreateCreativeInput.safeParse({
      ...feedbackButtonBody,
      distribution: {
        showOn: "pageView",
        triggers: [],
        conditions: { connector: "and", conditions: [{ id: "c1", operand: "nope" }] },
        displayPercentage: null,
      },
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.path.slice(0, 2).join(".") === "distribution.conditions")
    ).toBe(true);
  });
});

describe("list_creatives input", () => {
  test("is capped at 50 a page and rejects an unknown filter key", () => {
    expect(ZMcpListCreativesInput.safeParse({ workspaceId, limit: 51 }).success).toBe(false);
    expect(
      ZMcpListCreativesInput.safeParse({ workspaceId, filter: { status: { in: ["active"] } } }).success
    ).toBe(false);
    expect(ZMcpListCreativesInput.parse({ workspaceId }).limit).toBe(20);
  });
});

describe("get_creative_stats input", () => {
  test("extends the v3 stats query strictly with the creative id", () => {
    expect(ZMcpGetCreativeStatsInput.safeParse({ creativeId }).success).toBe(true);
    expect(
      ZMcpGetCreativeStatsInput.safeParse({
        creativeId,
        from: "2026-10-01",
        to: "2026-10-15",
        groupBy: "page",
      }).success
    ).toBe(true);
    expect(ZMcpGetCreativeStatsInput.safeParse({ creativeId, groupBy: "country" }).success).toBe(false);
    expect(ZMcpGetCreativeStatsInput.safeParse({ creativeId, from: "yesterday" }).success).toBe(false);
    expect(ZMcpGetCreativeStatsInput.safeParse({ creativeId, days: 7 }).success).toBe(false);
    expect(ZMcpGetCreativeStatsInput.safeParse({}).success).toBe(false);
  });
});

/**
 * The SDK validates every successful result against the tool's output schema, so a schema that is stricter
 * than the operation's real answer fails every call that would have succeeded. The operations' own tests
 * hold their answers to the generated schemas (`operations.test.ts`); these hold the tool envelopes to the
 * same ones, with the one deviation from the shared envelope made on purpose.
 */
describe("output envelopes", () => {
  const resource = zCreativeResource.parse({
    id: creativeId,
    workspaceId,
    name: "Site feedback",
    type: "feedbackButton",
    status: "draft",
    displayStatus: "draft",
    displayStatusReason: null,
    createdAt: "2026-10-16T08:00:00.000Z",
    updatedAt: "2026-10-16T08:00:00.000Z",
    publishedAt: null,
    archivedAt: null,
    creator: { name: "Dana" },
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true }],
    distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
    schedule: { startAt: null, endAt: null },
    warnings: [],
    content: { label: { "en-US": "Feedback" }, icon: "messageSquare" },
    styling: {
      position: { desktop: { edge: "right", offset: 50 }, phone: null },
      theme: {
        customStyles: false,
        backgroundColor: null,
        textColor: null,
        borderColor: null,
        borderRadius: null,
        fontWeight: null,
        fontSize: { desktop: null, phone: null },
        paddingX: { desktop: null, phone: null },
        paddingY: { desktop: null, phone: null },
      },
    },
    destination: null,
  });

  test("a creative", () => {
    expect(ZMcpCreativeOutput.safeParse({ data: resource, requestId: "req_1" }).success).toBe(true);
  });

  test("a creative list carries only the limit and cursor as `meta`", () => {
    expect(
      ZMcpCreativeListOutput.safeParse({
        data: [resource],
        meta: { limit: 20, nextCursor: null },
        requestId: "req_1",
      }).success
    ).toBe(true);
  });

  test("the stats of a range", () => {
    const stats = {
      creativeId,
      from: "2026-10-15",
      to: "2026-10-15",
      groupBy: null,
      totals: { impressions: 0, clicks: 0, clickRate: null },
      days: [{ date: "2026-10-15", impressions: 0, clicks: 0, clickRate: null }],
    };

    expect(ZMcpCreativeStatsOutput.safeParse({ data: stats, requestId: "req_1" }).success).toBe(true);
  });

  test("a delete, which answers 204 with nothing but the request id", () => {
    expect(ZMcpCreativeDeleteOutput.safeParse({ requestId: "req_1" }).success).toBe(true);
  });

  test("the error branch every tool can return", () => {
    const error = { status: 403, title: "Forbidden", detail: "Nope", requestId: "req_1", code: "forbidden" };

    expect(ZMcpCreativeOutput.safeParse({ error }).success).toBe(true);
  });
});
