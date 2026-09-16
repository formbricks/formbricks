import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import type { AuditLoggingCtx } from "@/lib/utils/action-client/types/context";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createSharedEmbeddedDataAction,
  deleteSharedEmbeddedDataAction,
  getEmbeddedDataUsageAction,
  getSharedEmbeddedDataAction,
  promoteEmbeddedDataToSharedAction,
  updateSharedEmbeddedDataAction,
} from "./actions";
import { EmbeddedDataInUseError, EmbeddedDataKeyConflictError } from "./types";

/**
 * The action layer, which is all the shared Embedded Data library gained when it stopped being a set
 * of `/api/v3` routes. Three claims, and none of them is about the service:
 *
 * - a single-field action authorizes against the workspace it read off the row, never one the caller
 *   named — the whole reason the id is the only input;
 * - the two refusals that carry structure come back as data, because `handleServerError` would
 *   flatten them to a string on the way out of a throw;
 * - a refusal is not an audit event, since nothing was created, updated or deleted.
 *
 * The action client, the audit wrapper and the schema are stubbed to identities, so a test calls the
 * handler directly — and `__schema` hands back the exact input schema each action was declared with,
 * which is otherwise unreachable once the real client has consumed it.
 */

const mocks = vi.hoisted(() => {
  const inputSchema = vi.fn((schema: unknown) => ({
    action: (handler: object) => Object.assign(handler, { __schema: schema }),
  }));

  return {
    inputSchema,
    applyRateLimit: vi.fn(),
    getOrganizationIdFromWorkspaceId: vi.fn(),
    createSharedEmbeddedData: vi.fn(),
    deleteSharedEmbeddedData: vi.fn(),
    getEmbeddedDataUsage: vi.fn(),
    getEmbeddedDataWorkspaceId: vi.fn(),
    getSharedEmbeddedData: vi.fn(),
    getSharedEmbeddedDataById: vi.fn(),
    promoteEmbeddedDataToShared: vi.fn(),
    updateSharedEmbeddedData: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: mocks.inputSchema },
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, handler) => handler),
}));
vi.mock("@/modules/embedded-data/lib/library", () => ({
  createSharedEmbeddedData: mocks.createSharedEmbeddedData,
  deleteSharedEmbeddedData: mocks.deleteSharedEmbeddedData,
  getEmbeddedDataUsage: mocks.getEmbeddedDataUsage,
  getEmbeddedDataWorkspaceId: mocks.getEmbeddedDataWorkspaceId,
  getSharedEmbeddedData: mocks.getSharedEmbeddedData,
  getSharedEmbeddedDataById: mocks.getSharedEmbeddedDataById,
  promoteEmbeddedDataToShared: mocks.promoteEmbeddedDataToShared,
  updateSharedEmbeddedData: mocks.updateSharedEmbeddedData,
}));

const workspaceId = "clww1234567890123456789012";
const otherWorkspaceId = "clxx1234567890123456789012";
const fieldId = "clff1234567890123456789012";
const surveyId = "clss1234567890123456789012";
const organizationId = "cloo1234567890123456789012";
const userId = "cluu1234567890123456789012";

const actor = { type: "user", id: userId };
const workspaceResource = { type: "workspace", id: workspaceId };

const field = {
  id: fieldId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested" as const,
  dataType: "string" as const,
  defaultValue: null,
  locked: false,
  surveyId: null,
  workspaceId,
};

const usage = [{ id: surveyId, name: "Onboarding", status: "inProgress" as const }];

type TTestCtx = { user: { id: string }; auditLoggingCtx: AuditLoggingCtx };
type TTestAction = ((args: { ctx: TTestCtx; parsedInput: Record<string, unknown> }) => Promise<unknown>) & {
  __schema: z.ZodType;
};

const run = (action: unknown, parsedInput: Record<string, unknown>, ctx: TTestCtx) =>
  (action as unknown as TTestAction)({ ctx, parsedInput });

const schemaOf = (action: unknown): z.ZodType => (action as unknown as TTestAction).__schema;

let ctx: TTestCtx;

beforeEach(() => {
  vi.clearAllMocks();
  ctx = { user: { id: userId }, auditLoggingCtx: { ipAddress: "unknown" } };
  vi.mocked(assertCan).mockResolvedValue(undefined);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
  mocks.getEmbeddedDataWorkspaceId.mockResolvedValue(workspaceId);
  mocks.getSharedEmbeddedData.mockResolvedValue([{ ...field, surveyCount: 2 }]);
  mocks.getSharedEmbeddedDataById.mockResolvedValue(field);
  mocks.getEmbeddedDataUsage.mockResolvedValue(usage);
  mocks.createSharedEmbeddedData.mockResolvedValue(field);
  mocks.updateSharedEmbeddedData.mockResolvedValue(field);
  mocks.deleteSharedEmbeddedData.mockResolvedValue(field);
  mocks.promoteEmbeddedDataToShared.mockResolvedValue(field);
});

describe("input schemas", () => {
  test("create takes the workspace and refuses a key the service does not accept", () => {
    const schema = schemaOf(createSharedEmbeddedDataAction);

    expect(
      schema.safeParse({ workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested" }).success
    ).toBe(true);
    expect(schema.safeParse({ key: "plan_tier", name: "Plan tier", source: "ingested" }).success).toBe(false);
    expect(
      schema.safeParse({ workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested", surveyId })
        .success
    ).toBe(false);
  });

  test("update carries the acknowledgement but never key or source", () => {
    const schema = schemaOf(updateSharedEmbeddedDataAction);

    expect(
      schema.safeParse({ id: fieldId, dataType: "number", acknowledgeExistingResponses: true }).success
    ).toBe(true);
    expect(schema.safeParse({ id: fieldId, key: "renamed" }).success).toBe(false);
    expect(schema.safeParse({ id: fieldId, source: "computed" }).success).toBe(false);
  });

  test.each([
    ["delete", deleteSharedEmbeddedDataAction, { id: fieldId }],
    ["usage", getEmbeddedDataUsageAction, { id: fieldId }],
    ["promote", promoteEmbeddedDataToSharedAction, { id: fieldId, key: "plan_tier" }],
  ])("%s takes an id and nothing that could redirect the scope", (_name, action, valid) => {
    const schema = schemaOf(action);

    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, id: "not-a-cuid" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, workspaceId }).success).toBe(false);
  });
});

describe("reads", () => {
  test("lists a workspace's library behind workspace.read, without spending the write budget", async () => {
    const result = await run(getSharedEmbeddedDataAction, { workspaceId }, ctx);

    expect(assertCan).toHaveBeenCalledWith(actor, "workspace.read", workspaceResource);
    expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    expect(mocks.getSharedEmbeddedData).toHaveBeenCalledWith(workspaceId);
    expect(result).toEqual([{ ...field, surveyCount: 2 }]);
  });

  test("reads usage against the workspace on the row", async () => {
    const result = await run(getEmbeddedDataUsageAction, { id: fieldId }, ctx);

    expect(mocks.getEmbeddedDataWorkspaceId).toHaveBeenCalledWith(fieldId);
    expect(assertCan).toHaveBeenCalledWith(actor, "workspace.read", workspaceResource);
    expect(mocks.getEmbeddedDataUsage).toHaveBeenCalledWith(fieldId, workspaceId);
    expect(result).toEqual(usage);
  });
});

describe("workspace scope", () => {
  test.each([
    ["usage", getEmbeddedDataUsageAction, { id: fieldId }],
    ["update", updateSharedEmbeddedDataAction, { id: fieldId, name: "Renamed" }],
    ["delete", deleteSharedEmbeddedDataAction, { id: fieldId }],
    ["promote", promoteEmbeddedDataToSharedAction, { id: fieldId, key: "plan_tier" }],
  ])(
    "%s refuses an id no row answers to, before authorizing anything",
    async (_name, action, parsedInput) => {
      mocks.getEmbeddedDataWorkspaceId.mockResolvedValue(null);

      await expect(run(action, parsedInput, ctx)).rejects.toBeInstanceOf(ResourceNotFoundError);
      expect(assertCan).not.toHaveBeenCalled();
    }
  );

  test.each([
    ["update", updateSharedEmbeddedDataAction, { id: fieldId, name: "Renamed" }],
    ["delete", deleteSharedEmbeddedDataAction, { id: fieldId }],
    ["promote", promoteEmbeddedDataToSharedAction, { id: fieldId, key: "plan_tier" }],
  ])(
    "%s authorizes and rate-limits against the workspace it read off the row",
    async (_name, action, parsedInput) => {
      mocks.getEmbeddedDataWorkspaceId.mockResolvedValue(otherWorkspaceId);

      await run(action, parsedInput, ctx);

      expect(assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
        type: "workspace",
        id: otherWorkspaceId,
      });
      expect(mocks.applyRateLimit).toHaveBeenCalledWith(
        rateLimitConfigs.actions.stateMutation,
        otherWorkspaceId
      );
      expect(ctx.auditLoggingCtx.organizationId).toBe(organizationId);
    }
  );
});

describe("writes", () => {
  test("create passes the library input on and records the new row", async () => {
    const input = { key: "plan_tier", name: "Plan tier", source: "ingested" as const };

    const result = await run(createSharedEmbeddedDataAction, { workspaceId, ...input }, ctx);

    expect(assertCan).toHaveBeenCalledWith(actor, "workspace.write", workspaceResource);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, workspaceId);
    expect(mocks.createSharedEmbeddedData).toHaveBeenCalledWith(workspaceId, input);
    expect(result).toEqual({ status: "ok", field });
    expect(ctx.auditLoggingCtx.embeddedDataId).toBe(fieldId);
    expect(ctx.auditLoggingCtx.newObject).toEqual(field);
  });

  test("update forwards the acknowledgement as an option and records both sides of the edit", async () => {
    const before = { ...field, dataType: "number" as const };
    mocks.getSharedEmbeddedDataById.mockResolvedValue(before);

    const result = await run(
      updateSharedEmbeddedDataAction,
      { id: fieldId, dataType: "string", acknowledgeExistingResponses: true },
      ctx
    );

    expect(mocks.updateSharedEmbeddedData).toHaveBeenCalledWith(
      fieldId,
      workspaceId,
      { dataType: "string" },
      { acknowledgeExistingResponses: true }
    );
    expect(result).toEqual({ status: "ok", field });
    expect(ctx.auditLoggingCtx.oldObject).toEqual(before);
    expect(ctx.auditLoggingCtx.newObject).toEqual(field);
  });

  test("delete keeps the removed row as the whole record of what happened", async () => {
    const result = await run(deleteSharedEmbeddedDataAction, { id: fieldId }, ctx);

    expect(mocks.deleteSharedEmbeddedData).toHaveBeenCalledWith(fieldId, workspaceId);
    expect(result).toEqual({ status: "ok", field });
    expect(ctx.auditLoggingCtx.oldObject).toEqual(field);
    expect(ctx.auditLoggingCtx.newObject).toBeUndefined();
  });

  test("promote sends only the library name, never the id it resolved the scope from", async () => {
    const result = await run(
      promoteEmbeddedDataToSharedAction,
      { id: fieldId, key: "plan_tier", description: "Billing plan" },
      ctx
    );

    expect(mocks.promoteEmbeddedDataToShared).toHaveBeenCalledWith(fieldId, workspaceId, {
      key: "plan_tier",
      description: "Billing plan",
    });
    expect(result).toEqual({ status: "ok", field });
    expect(ctx.auditLoggingCtx.newObject).toEqual(field);
  });
});

describe("refusals that carry a payload", () => {
  test("a delete blocked by surveys answers with them rather than a flattened message", async () => {
    mocks.deleteSharedEmbeddedData.mockRejectedValue(
      new EmbeddedDataInUseError("Cannot delete a field that is used by a survey", usage)
    );

    const result = await run(deleteSharedEmbeddedDataAction, { id: fieldId }, ctx);

    expect(result).toEqual({
      status: "inUse",
      message: "Cannot delete a field that is used by a survey",
      usage,
    });
    expect(ctx.auditLoggingCtx.suppressEvent).toBe(true);
    expect(ctx.auditLoggingCtx.oldObject).toBeUndefined();
  });

  test("a data-type change blocked by responses answers with the surveys holding them", async () => {
    mocks.updateSharedEmbeddedData.mockRejectedValue(
      new EmbeddedDataInUseError("Cannot change the data type of a field that already has responses", usage)
    );

    const result = await run(updateSharedEmbeddedDataAction, { id: fieldId, dataType: "number" }, ctx);

    expect(result).toEqual({
      status: "inUse",
      message: "Cannot change the data type of a field that already has responses",
      usage,
    });
    expect(ctx.auditLoggingCtx.suppressEvent).toBe(true);
    expect(ctx.auditLoggingCtx.newObject).toBeUndefined();
  });

  test("a promote onto a taken key answers with the row holding it, so the editor can offer it", async () => {
    const existingId = "clee1234567890123456789012";
    mocks.promoteEmbeddedDataToShared.mockRejectedValue(new EmbeddedDataKeyConflictError(existingId));

    const result = await run(promoteEmbeddedDataToSharedAction, { id: fieldId, key: "plan_tier" }, ctx);

    expect(result).toEqual({ status: "keyConflict", existingId });
    expect(ctx.auditLoggingCtx.suppressEvent).toBe(true);
  });

  test("a create onto a taken key has no row to offer", async () => {
    mocks.createSharedEmbeddedData.mockRejectedValue(new EmbeddedDataKeyConflictError());

    const result = await run(
      createSharedEmbeddedDataAction,
      { workspaceId, key: "plan_tier", name: "Plan tier", source: "ingested" },
      ctx
    );

    expect(result).toEqual({ status: "keyConflict", existingId: null });
    expect(ctx.auditLoggingCtx.suppressEvent).toBe(true);
    expect(ctx.auditLoggingCtx.embeddedDataId).toBeUndefined();
  });

  test("everything else still throws, so the action client reports it and the failure is audited", async () => {
    mocks.createSharedEmbeddedData.mockRejectedValue(new InvalidInputError("Key is reserved"));

    await expect(
      run(
        createSharedEmbeddedDataAction,
        { workspaceId, key: "userId", name: "User id", source: "ingested" },
        ctx
      )
    ).rejects.toThrow("Key is reserved");
    expect(ctx.auditLoggingCtx.suppressEvent).toBeUndefined();
  });
});
