import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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
    invalid_params?: ProblemBody["invalid_params"];
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
        ...(Array.isArray(problem.invalid_params) ? { invalid_params: problem.invalid_params } : {}),
      },
    },
    true
  );
}
