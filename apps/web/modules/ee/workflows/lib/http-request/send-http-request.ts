import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TWorkflowHttpMethod } from "@formbricks/workflows";
import { DANGEROUSLY_ALLOW_WORKFLOW_PLAIN_HTTP } from "@/lib/constants";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";

/** One outbound call, fully rendered: Variables inserted, secret header values decrypted. */
export interface WorkflowHttpCall {
  method: TWorkflowHttpMethod;
  /** The step's fixed URL with its query string appended. */
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface WorkflowHttpResponse {
  status: number;
  contentType: string | null;
  /** At most `WORKFLOW_HTTP_MAX_RESPONSE_BYTES` of the body, decoded as UTF-8. */
  bodyText: string;
  truncated: boolean;
}

export interface WorkflowHttpCallResult {
  /** The last answer the target gave, or null when no attempt got one. */
  response: WorkflowHttpResponse | null;
  /** Why no answer came (timeout, network, refused URL); null when there is a response. Never holds header values. */
  error: string | null;
  attempts: number;
}

/** Spec §10: 10 s per attempt, 1 MB read, 3 retries. */
export const WORKFLOW_HTTP_TIMEOUT_MS = 10_000;
export const WORKFLOW_HTTP_MAX_RESPONSE_BYTES = 1024 * 1024;
export const WORKFLOW_HTTP_RETRIES = 3;
/** Wait before retry n (1-based): 1 s, 2 s, 4 s. With 10 s attempts a step holds a worker ≲ 50 s (ADR 0047). */
const RETRY_BASE_DELAY_MS = 1_000;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type AttemptOutcome =
  | { kind: "response"; response: WorkflowHttpResponse }
  | { kind: "error"; error: string; retryable: boolean };

const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

/** Host only, for log lines: a URL's path or query may carry a capability token. */
const urlHost = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

/** HTTPS unless this self-hosted instance allows plain HTTP (ENG-7167); never any other scheme. */
const assertAllowedScheme = (url: string): void => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new InvalidInputError("The HTTP request URL is not a valid URL");
  }
  if (protocol === "https:") return;
  if (protocol === "http:" && DANGEROUSLY_ALLOW_WORKFLOW_PLAIN_HTTP) return;
  throw new InvalidInputError("The HTTP request URL must use HTTPS");
};

/** Reads the body up to the cap, then stops reading; the rest is never downloaded into memory. */
const readCappedBody = async (response: Response): Promise<{ text: string; truncated: boolean }> => {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = WORKFLOW_HTTP_MAX_RESPONSE_BYTES - received;
    if (value.byteLength >= room) {
      chunks.push(value.subarray(0, room));
      received += room;
      truncated = value.byteLength > room;
      if (!truncated) continue;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), truncated };
};

const isTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

const attempt = async (call: WorkflowHttpCall, timeoutMs: number): Promise<AttemptOutcome> => {
  let address: Awaited<ReturnType<typeof validateAndResolveWebhookUrl>>;
  try {
    assertAllowedScheme(call.url);
    // The Webhooks integration's SSRF check: private addresses only behind
    // DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS (ignored on Cloud), and the IP it checked is the one used.
    address = await validateAndResolveWebhookUrl(call.url);
  } catch (error) {
    // A refused URL never becomes deliverable, so it is not retried.
    return {
      kind: "error",
      error: error instanceof Error ? error.message : "The HTTP request URL was refused",
      retryable: false,
    };
  }

  const dispatcher = address ? createPinnedDispatcher(address) : undefined;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(call.url, {
      method: call.method,
      headers: call.headers,
      body: call.body,
      // Never follow: a redirect could point the request, and its secret headers, at another host.
      redirect: "manual",
      signal,
      dispatcher,
    } as RequestInit);
    const { text, truncated } = await readCappedBody(response);
    return {
      kind: "response",
      response: {
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyText: text,
        truncated,
      },
    };
  } catch (error) {
    if (isTimeout(error) || signal.aborted) {
      return {
        kind: "error",
        error: `The request timed out after ${(timeoutMs / 1000).toString()} s`,
        retryable: true,
      };
    }
    return { kind: "error", error: "The request could not be sent (network error)", retryable: true };
  } finally {
    // destroy(), not close(): close() waits for a target that accepted the connection but never answered.
    await dispatcher?.destroy().catch((cleanupError: unknown) => {
      logger.warn({ err: cleanupError, host: urlHost(call.url) }, "Workflow HTTP dispatcher cleanup failed");
    });
  }
};

/**
 * The one way a workflow calls an outside URL (ENG-7168): the HTTP request step, its "Don't wait" job
 * and Send test request all go through here, so the address checks cannot drift between them.
 *
 * Every attempt checks the scheme (HTTPS unless the plain-HTTP switch) and the address (the Webhooks
 * SSRF check, pinned to the checked IP), never follows redirects, times out after 10 s and reads at
 * most 1 MB. Timeouts, network errors, 429 and 5xx are retried `retries` times with 1 s / 2 s / 4 s
 * waits; any other answer, and a refused URL, ends it. Never throws for an outcome of the call.
 */
export const sendWorkflowHttpRequest = async (
  call: WorkflowHttpCall,
  {
    retries,
    timeoutMs = WORKFLOW_HTTP_TIMEOUT_MS,
    sleep = defaultSleep,
  }: { retries: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void> }
): Promise<WorkflowHttpCallResult> => {
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const outcome = await attempt(call, timeoutMs);
    const retryable =
      outcome.kind === "error" ? outcome.retryable : isRetryableStatus(outcome.response.status);
    if (!retryable || attempts > retries) {
      return outcome.kind === "response"
        ? { response: outcome.response, error: null, attempts }
        : { response: null, error: outcome.error, attempts };
    }
    await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempts - 1));
  }
};
