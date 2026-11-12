import type {
  AuthInfo,
  CallToolResult,
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
  ToolCallback,
} from "@modelcontextprotocol/server";
import { logger } from "@formbricks/logger";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import type { TAuditAction, TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import {
  type TMcpToolContext,
  createMcpInsufficientScopeResponse,
  getMcpAuthentication,
  getMcpRequestId,
  getMcpToolAuthInfo,
  hasAnyMcpScope,
  hasMcpScopes,
} from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpPermissionRequirement,
  getMcpPermissionScope,
  isMcpPermissionRequirement,
} from "../permissions";

/**
 * Shared MCP scope gate: returns `null` when the caller holds all `requiredScopes`, otherwise an
 * insufficient-scope tool result.
 *
 * Private on purpose (ENG-2119). It was briefly exported so the feedback-record tools could gate
 * inside their own handler factories, which made the guarantee conventional rather than structural —
 * a tool added outside those factories would have registered unguarded. Those tools are on
 * `registerMcpTool` now, so this goes back to being reachable only through it.
 *
 * What that buys is narrower than it looks, and an earlier version of this comment claimed too much.
 * Privacy removes the *hand-rolled gate* — a module can no longer check scopes itself and diverge from
 * the shared behaviour. It does not make an unguarded registration impossible: `server` is an argument
 * to every tool module, so `server.registerTool(...)` is always one call away. Nothing in the type
 * system prevents that, and nothing can. Tests are what catch it — `tool-permissions.test.ts` pins every
 * registered tool's permissions, and `feedback-records.test.ts` drives all ten tools with the opposite
 * scope, which fails if any of them stops being gated.
 */
async function guardMcpScopes(
  authInfo: AuthInfo | undefined,
  requiredScopes: string[],
  requestId: string
): Promise<CallToolResult | null> {
  if (hasMcpScopes(authInfo, requiredScopes)) {
    return null;
  }

  return await responseToMcpToolResult(
    createMcpInsufficientScopeResponse(requestId, requiredScopes),
    requestId
  );
}

/**
 * Any-of variant for tools that more than one permission legitimately reaches — currently the
 * workspace discovery tool, which the survey, workflow and feedback-record tools all need to resolve a
 * `workspaceId`. Returns `null` when the caller holds at least one of `allowedScopes`. The challenge
 * still advertises the full list, since RFC 6750 has no way to express "any one of these".
 *
 * Private for the same reason as its sibling: reachable only through `registerMcpTool`'s
 * `{ anyOf: [...] }` form.
 */
async function guardMcpAnyScope(
  authInfo: AuthInfo | undefined,
  allowedScopes: string[],
  requestId: string
): Promise<CallToolResult | null> {
  if (hasAnyMcpScope(authInfo, allowedScopes)) {
    return null;
  }

  return await responseToMcpToolResult(
    createMcpInsufficientScopeResponse(requestId, allowedScopes),
    requestId
  );
}

/**
 * What a refused call would have done — enough to write it down as a failed attempt. `targetIdArg` names
 * the input argument that carries the id of the resource the tool would have changed; a tool that would
 * have *created* something declares none, because the ids in its input name other things — the workspace
 * a survey would go into, the workflow `duplicate_workflow` would copy — and recording one of those as the
 * target of a failed creation would be a false record.
 */
type TMcpToolAudit = { action: TAuditAction; targetType: TAuditTarget; targetIdArg?: string };

/**
 * Record a scope refusal on a mutating tool as a failed audit event (ENG-2872).
 *
 * The gate runs before `runMcpMutation`, so without this a caller reaching for `delete_response` with a
 * read-only credential left no trace at all — the one attempt an audit trail exists to show. The actor is
 * known here (the request authenticated; it merely lacks the scope), which is what makes the event
 * attributable; a 401 has no actor and is deliberately not audited anywhere on this surface.
 */
async function auditRefusedMutation(
  toolName: string,
  audit: TMcpToolAudit,
  input: unknown,
  authInfo: AuthInfo | undefined,
  requestId: string
): Promise<void> {
  const auditLog = buildV3AuditLog(
    getMcpAuthentication(authInfo),
    audit.action,
    audit.targetType,
    getMcpResourceUrl()
  );
  if (!auditLog) {
    return;
  }

  // `buildAuditLogBaseObject` starts every event as a failure; only a completed mutation flips it.
  auditLog.eventId = requestId;
  if (audit.targetIdArg && input && typeof input === "object") {
    const targetId = (input as Record<string, unknown>)[audit.targetIdArg];
    if (typeof targetId === "string") {
      auditLog.targetId = targetId;
    }
  }

  await queueV3AuditLog(auditLog, requestId, logger.withContext({ requestId, tool: toolName }));
}

type TNonEmpty<T> = readonly [T, ...T[]];

/**
 * The permissions a tool needs, each at a minimum access level (`GLOSSARY.md`, "MCP access"). Usually a
 * fixed all-of list; `{ anyOf }` for a tool several permissions reach (workspace discovery); `{ byInput }`
 * for the rare tool whose input picks between two reads with different needs (`get_chart_data`: a chart
 * alone, or a chart through its dashboard, which a Dashboard viewer may read without Feedback records).
 * A tool declares every permission whose data it returns, not only the one it is named after.
 */
type TMcpToolPermissions =
  | TNonEmpty<TMcpPermissionRequirement>
  | { anyOf: TNonEmpty<TMcpPermissionRequirement> }
  | {
      byInput: (input: unknown, authInfo: AuthInfo | undefined) => TNonEmpty<TMcpPermissionRequirement>;
    };

/**
 * The scopes the requirements map to, in declaration order and each once — Surveys and Survey styling
 * both need `surveys:read`. Until grants exist (ENG-7149) the token's scopes are the whole check.
 */
const toScopes = (requirements: readonly TMcpPermissionRequirement[]): string[] => [
  ...new Set(requirements.map(getMcpPermissionScope)),
];

/** True for a non-empty list of valid requirements — what registration and `byInput` must produce. */
const isValidPermissionList = (value: unknown): value is TNonEmpty<TMcpPermissionRequirement> =>
  Array.isArray(value) && value.length > 0 && value.every(isMcpPermissionRequirement);

/**
 * A tool that declares no permission, or one the registry does not offer, would join no grant, so it
 * must not register. The types already refuse this; the check covers a cast or a computed list. A
 * `byInput` tool can only be checked per call, where an invalid list is refused (`guardPermissions`).
 */
const assertDeclaresPermissions = (name: string, permissions: TMcpToolPermissions): void => {
  if ("byInput" in permissions && typeof permissions.byInput === "function") return;
  const list = "anyOf" in permissions ? permissions.anyOf : permissions;
  if (!isValidPermissionList(list)) {
    throw new Error(
      `MCP tool "${name}" must declare at least one permission from the registry, each at a level it offers`
    );
  }
};

const guardPermissions = async (
  permissions: TMcpToolPermissions,
  input: unknown,
  authInfo: AuthInfo | undefined,
  requestId: string
): Promise<CallToolResult | null> => {
  if ("anyOf" in permissions) return await guardMcpAnyScope(authInfo, toScopes(permissions.anyOf), requestId);
  if ("byInput" in permissions) {
    const selected: unknown = permissions.byInput(input, authInfo);
    // Fail closed: an empty or invalid list would otherwise gate on nothing.
    if (!isValidPermissionList(selected)) {
      return await responseToMcpToolResult(createMcpInsufficientScopeResponse(requestId, []), requestId);
    }
    return await guardMcpScopes(authInfo, toScopes(selected), requestId);
  }
  return await guardMcpScopes(authInfo, toScopes(permissions), requestId);
};

type McpToolConfig<
  InputSchema extends StandardSchemaWithJSON,
  OutputSchema extends StandardSchemaWithJSON,
> = {
  title?: string;
  description?: string;
  inputSchema?: InputSchema;
  /**
   * The shape of `structuredContent`, advertised on `tools/list`.
   *
   * Optional only because the tools that predate it have none. New tools declare one: without it a
   * client has to infer the result shape from an example, and the SDK cannot tell a tool that
   * answered the wrong shape from one that answered correctly. Build it with `mcpToolOutput` so the
   * error branch every tool can return is described too.
   */
  outputSchema?: OutputSchema;
  annotations?: ToolAnnotations;
  /**
   * Set on every mutating tool and on nothing else (ENG-2872). A refused *read* discloses nothing and
   * would only add noise; a refused mutation is exactly what an audit reviewer wants to see, and it is
   * the guard's to record because the tool's own runner never runs.
   */
  audit?: TMcpToolAudit;
};

/**
 * Register an MCP tool with a MANDATORY permission gate. `permissions` is a required argument, and a
 * tool whose declaration is empty or names a permission or level the registry (`../permissions.ts`) does
 * not offer throws at registration — so every tool joins the grant a user sets, and none reaches a v3
 * operation unguarded. The gate always runs BEFORE the handler and answers a refusal with a 403 tool
 * result.
 *
 * This is the single registration path for every MCP tool (ENG-2119): the guards below are private, so
 * a tool module cannot gate by hand even if it wanted to. Read tools declare their permissions at
 * `read`, mutating tools at `write`. Until grants are enforced (ENG-7149) each permission maps to its
 * scope family at that level (`getMcpPermissionScope`), so a tool is allowed and refused for exactly the
 * scopes it was before permissions replaced scopes here.
 *
 * Pass `{ anyOf: [...] }` for the rare tool that several permissions legitimately reach (workspace
 * discovery), and `{ byInput }` for a tool whose input decides what it reads.
 *
 * A mutating tool also declares `audit`, and a refusal on it is written to the audit log as a failed
 * attempt before the 403 goes back (ENG-2872).
 *
 * Adding a tool: docs/development/technical-handbook/mcp-server.mdx ("Adding a tool").
 */
export function registerMcpTool<
  InputSchema extends StandardSchemaWithJSON,
  OutputSchema extends StandardSchemaWithJSON,
>(
  server: McpServer,
  name: string,
  config: McpToolConfig<InputSchema, OutputSchema>,
  permissions: TMcpToolPermissions,
  handler: ToolCallback<InputSchema>
): void {
  assertDeclaresPermissions(name, permissions);

  // `audit` is the guard's, not the SDK's. Stripped only when present, so a plain config still reaches
  // `registerTool` as the very object the caller built.
  const { audit, ...toolConfig } = config;

  const guardedHandler = (async (input: unknown, ctx: TMcpToolContext) => {
    const authInfo = getMcpToolAuthInfo(ctx);
    const requestId = getMcpRequestId(authInfo);
    const scopeError = await guardPermissions(permissions, input, authInfo, requestId);
    if (scopeError) {
      if (audit) {
        await auditRefusedMutation(name, audit, input, authInfo, requestId);
      }
      return scopeError;
    }
    // Cast needed only because ToolCallback<InputSchema> is a conditional signature that TS can't call
    // with the erased `unknown` params here. It's safe: the SDK validates `input` against this tool's
    // inputSchema BEFORE invoking guardedHandler, and we forward the exact same `input`/`ctx` through
    // unchanged — so the runtime value already conforms to the handler's declared type; nothing is
    // reshaped.
    return (handler as (input: unknown, ctx: unknown) => Promise<CallToolResult>)(input, ctx);
  }) as ToolCallback<InputSchema>;

  server.registerTool(name, audit ? toolConfig : config, guardedHandler);
}
