import type { McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ZodType } from "zod";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { ZV3CreateCreativeBody } from "@/app/api/v3/creatives/lib/schemas";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getCreativesAccess } from "@/modules/ee/creatives/lib/access";
import type { TCreativesAccess } from "@/modules/ee/creatives/lib/access-rules";
import { toCreativeRowData } from "@/modules/ee/creatives/lib/record";
import {
  type TCreativeRecord,
  deleteCreativeRecord,
  findCreativeRecord,
  findCreativeRecordsPage,
  findCreativeWorkspaceId,
  insertCreativeRecord,
  lockCreativeRecord,
  replaceCreativeRecord,
  updateCreativeLifecycleColumns,
} from "@/modules/ee/creatives/lib/repository";
import { buildCreativeCreateState } from "@/modules/ee/creatives/lib/write-rules";
import { registerCreativeTools } from "./creatives";

/**
 * The creative tools under each Creatives access level (ENG-6602). Unlike `creatives.test.ts`, the v3
 * operations are real here, so this proves the tools inherit the licence gate rather than re-implement
 * it: only the access level, the workspace permission and storage are replaced.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  getV3SessionUserId: (await importOriginal<typeof import("@/app/api/v3/lib/auth")>()).getV3SessionUserId,
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(() => ({ status: "failure" })),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/creatives/lib/access", () => ({ getCreativesAccess: vi.fn() }));
vi.mock("@/modules/ee/creatives/lib/repository", () => ({
  findCreativeWorkspaceId: vi.fn(),
  findCreativeRecord: vi.fn(),
  lockCreativeRecord: vi.fn(),
  findCreativeRecordsPage: vi.fn(),
  runInCreativeTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  ensureCreativeLanguages: vi.fn(async () => [{ languageId: "lang_en", default: true, enabled: true }]),
  findWorkspaceActionClassIds: vi.fn(async () => []),
  lockDestinationSurvey: vi.fn(async () => null),
  insertCreativeRecord: vi.fn(),
  replaceCreativeRecord: vi.fn(),
  updateCreativeLifecycleColumns: vi.fn(),
  deleteCreativeRecord: vi.fn(async () => undefined),
}));
vi.mock("@/modules/ee/creatives/lib/stats-repository", () => ({
  findCreativeDayDeviceCounts: vi.fn(async () => []),
  findCreativePageCounts: vi.fn(async () => []),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const workspaceId = "clws1234567890123456789012";
const organizationId = "clor1234567890123456789012";
const creativeId = "clcr1234567890123456789012";

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["surveys:read", "surveys:write"],
  extra: {
    formbricksAuthentication: {
      type: "apiKey" as const,
      apiKeyId: "key_1",
      organizationId,
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: ApiKeyPermission.write }],
    },
    requestId: "req_tool",
  },
};

/** A published feedback button that opens a link, stored as the repository returns it. */
const buildRecord = (): TCreativeRecord => {
  const state = buildCreativeCreateState(
    ZV3CreateCreativeBody.parse({
      workspaceId,
      name: "Feedback tab",
      type: "feedbackButton",
      status: "inProgress",
      content: { label: { "en-US": "Feedback" }, icon: null },
      destination: { type: "link", url: "https://example.com/feedback" },
    }),
    new Date()
  );
  const row = toCreativeRowData(state);
  return {
    ...row,
    showConditions: row.showConditions ?? null,
    id: creativeId,
    workspaceId,
    type: state.type,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    creator: null,
    triggers: [],
    languages: [{ default: true, enabled: true, language: { code: "en-US" } }],
    survey: null,
  } as unknown as TCreativeRecord;
};

type TToolResult = { isError?: boolean; structuredContent: Record<string, unknown> };
type TTool = {
  config: { inputSchema: ZodType };
  handler: (input: unknown, extra: unknown) => Promise<TToolResult>;
};

const createToolServer = () => {
  const tools = new Map<string, TTool>();
  const server = {
    registerTool: vi.fn((name: string, config: TTool["config"], handler: TTool["handler"]) => {
      tools.set(name, { config, handler });
    }),
  };
  registerCreativeTools(server as unknown as McpServer);
  return tools;
};

/** Calls a tool the way the SDK does: its input parsed by the tool's own schema first. */
const callTool = (name: string, input: Record<string, unknown>): Promise<TToolResult> => {
  const tool = createToolServer().get(name)!;
  return tool.handler(tool.config.inputSchema.parse(input), { http: { authInfo } });
};

/** Every tool, and `patch_creative` once per operation its body can be. */
const CALLS: { label: string; tool: string; input: Record<string, unknown>; windDown: boolean }[] = [
  { label: "list_creatives", tool: "list_creatives", input: { workspaceId }, windDown: true },
  { label: "get_creative", tool: "get_creative", input: { creativeId }, windDown: true },
  { label: "get_creative_stats", tool: "get_creative_stats", input: { creativeId }, windDown: true },
  {
    label: "patch_creative pausing",
    tool: "patch_creative",
    input: { creativeId, data: { status: "paused" } },
    windDown: true,
  },
  {
    label: "patch_creative closing",
    tool: "patch_creative",
    input: { creativeId, data: { status: "completed" } },
    windDown: true,
  },
  { label: "delete_creative", tool: "delete_creative", input: { creativeId }, windDown: true },
  {
    label: "create_creative",
    tool: "create_creative",
    input: {
      workspaceId,
      name: "Feedback tab",
      type: "feedbackButton",
      content: { label: { "en-US": "Feedback" }, icon: null },
    },
    windDown: false,
  },
  {
    label: "patch_creative resuming",
    tool: "patch_creative",
    input: { creativeId, data: { status: "inProgress" } },
    windDown: false,
  },
  {
    label: "patch_creative changing content",
    tool: "patch_creative",
    input: { creativeId, data: { name: "Renamed" } },
    windDown: false,
  },
  {
    label: "patch_creative pausing and renaming",
    tool: "patch_creative",
    input: { creativeId, data: { status: "paused", name: "Renamed" } },
    windDown: false,
  },
  { label: "duplicate_creative", tool: "duplicate_creative", input: { creativeId }, windDown: false },
  { label: "archive_creative", tool: "archive_creative", input: { creativeId }, windDown: false },
  { label: "restore_creative", tool: "restore_creative", input: { creativeId }, windDown: false },
];

const withAccess = (access: TCreativesAccess) => vi.mocked(getCreativesAccess).mockResolvedValue(access);

const expectNotEntitled = (result: TToolResult, label: string) => {
  expect(result.isError, label).toBe(true);
  expect(result.structuredContent.error, label).toMatchObject({
    status: 403,
    code: "creatives_not_entitled",
    requestId: "req_tool",
  });
};

const expectNothingWritten = () => {
  expect(insertCreativeRecord).not.toHaveBeenCalled();
  expect(replaceCreativeRecord).not.toHaveBeenCalled();
  expect(updateCreativeLifecycleColumns).not.toHaveBeenCalled();
  expect(deleteCreativeRecord).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  const record = buildRecord();
  vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_auth, id) => ({
    workspaceId: id,
    organizationId,
  }));
  vi.mocked(findCreativeWorkspaceId).mockResolvedValue(workspaceId);
  vi.mocked(findCreativeRecord).mockResolvedValue(record);
  vi.mocked(lockCreativeRecord).mockResolvedValue(record);
  vi.mocked(updateCreativeLifecycleColumns).mockImplementation(async (_tx, _id, _workspaceId, columns) => ({
    ...record,
    ...columns,
  }));
  vi.mocked(findCreativeRecordsPage).mockResolvedValue([record]);
  vi.mocked(insertCreativeRecord).mockResolvedValue(record);
  vi.mocked(replaceCreativeRecord).mockImplementation(async (_tx, _id, _workspaceId, data) => ({
    ...record,
    ...(data.row as Partial<TCreativeRecord>),
  }));
});

describe("creative tools under the Creatives licence (ENG-6602)", () => {
  test("with the licence, every tool runs", async () => {
    withAccess("full");

    for (const { label, tool, input } of CALLS) {
      const result = await callTool(tool, input);
      expect(result.isError, `${label}: ${JSON.stringify(result.structuredContent)}`).toBeUndefined();
    }
  });

  test("without it and nothing to wind down, every tool answers the not-entitled 403 as a tool error", async () => {
    withAccess("none");

    for (const { label, tool, input } of CALLS) {
      expectNotEntitled(await callTool(tool, input), label);
    }
    expectNothingWritten();
  });

  test("in wind-down, an agent can list, read, pause, close and delete creatives, and nothing else", async () => {
    withAccess("windDown");

    for (const { label, tool, input } of CALLS.filter(({ windDown }) => !windDown)) {
      expectNotEntitled(await callTool(tool, input), label);
    }
    expectNothingWritten();

    for (const { label, tool, input } of CALLS.filter(({ windDown }) => windDown)) {
      const result = await callTool(tool, input);
      expect(result.isError, `${label}: ${JSON.stringify(result.structuredContent)}`).toBeUndefined();
    }
    expect(replaceCreativeRecord).toHaveBeenCalledTimes(2);
    expect(deleteCreativeRecord).toHaveBeenCalledTimes(1);
  });
});
