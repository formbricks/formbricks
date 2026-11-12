import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ProblemBody } from "@/app/api/v3/lib/response";

type TMcpSuccessPayload = Record<string, unknown> & {
  requestId: string;
};

type TMcpErrorPayload = {
  error: {
    status: number;
    title: string;
    detail: string;
    requestId: string;
    code?: string;
    // ENG-3069: a 409 carries `expectedUpdatedAt`/`currentUpdatedAt` here. Dropping it would leave an
    // agent with a retry it cannot perform — it would have to re-read the whole survey to learn the
    // timestamp the error already knew.
    details?: NonNullable<ProblemBody["details"]>;
    invalid_params?: NonNullable<ProblemBody["invalid_params"]>;
  };
};

function toTextResult(payload: TMcpSuccessPayload | TMcpErrorPayload, isError = false): CallToolResult {
  return {
    ...(isError ? { isError: true } : {}),
    structuredContent: payload,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function responseToMcpToolResult(
  response: Response,
  fallbackRequestId: string
): Promise<CallToolResult> {
  const body = await readJsonResponse(response);
  const requestId =
    typeof body.requestId === "string"
      ? body.requestId
      : (response.headers.get("X-Request-Id") ?? fallbackRequestId);

  if (response.ok) {
    return toTextResult({
      ...body,
      requestId,
    });
  }

  const problem = body as Partial<ProblemBody>;
  return toTextResult(
    {
      error: {
        status: response.status,
        title: typeof problem.title === "string" ? problem.title : "Error",
        detail: typeof problem.detail === "string" ? problem.detail : response.statusText || "Request failed",
        requestId,
        ...(typeof problem.code === "string" ? { code: problem.code } : {}),
        ...(isPlainRecord(problem.details) ? { details: problem.details } : {}),
        ...(Array.isArray(problem.invalid_params) ? { invalid_params: problem.invalid_params } : {}),
      },
    },
    true
  );
}

/**
 * The problem codes an id outside a grant could otherwise be told apart by. Only these two exact pairs:
 * every other code, a 403 included, passes through.
 */
const HIDDEN_STATUSES: ReadonlyMap<number, string> = new Map([
  [403, "forbidden"],
  [404, "not_found"],
]);

/**
 * For a request whose grant limits organization & workspace access (ADR-0042): anything outside the grant
 * does not exist for the client. `can()` denies such a resource, and the v3 operation then answers as it
 * does for a role it refuses (`403 forbidden`) or an id it can't find (`404 not_found`), each with its own
 * body. So every such answer becomes one not found, with nothing taken from the operation's body: an id
 * outside the grant, an unknown id and a refusal by the user's own role read alike, and the client can't
 * learn what else exists.
 *
 * Every other answer passes through unchanged: a validation error, a rate limit, and a plan or
 * entitlement refusal. The latter each carry their own code (`contacts_not_entitled`,
 * `creatives_not_entitled`, `dashboards_plan_required`, `workflows_not_entitled`, …), never plain
 * `forbidden`, and an operation checks them after authorization, so they reveal nothing outside the
 * grant. A new entitlement check must answer with its own code too, or it reads here as not found.
 */
export function hideOutsideMcpGrant(result: CallToolResult, requestId: string): CallToolResult {
  if (!result.isError) return result;
  const error = (result.structuredContent as Partial<TMcpErrorPayload> | undefined)?.error;
  if (!error || HIDDEN_STATUSES.get(error.status) !== error.code) return result;
  return toTextResult(
    {
      error: {
        status: 404,
        title: "Not Found",
        code: "not_found",
        detail: "Not found. It doesn't exist, or the user's grant to this MCP client doesn't reach it.",
        requestId,
      },
    },
    true
  );
}
