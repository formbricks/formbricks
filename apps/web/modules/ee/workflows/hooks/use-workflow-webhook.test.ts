/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkflowWebhook } from "./use-workflow-webhook";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseWorkflowWebhookTestWrapper";
  return Wrapper;
}

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const WORKFLOW_ID = "clxk6l7bm0000qz8f1x2y3z4a";

const webhookResponse = () =>
  new Response(
    JSON.stringify({
      data: {
        workflowId: WORKFLOW_ID,
        url: "https://app.example.com/api/v3/workflows/x/webhook/secret",
        lastCalledAt: null,
        lastCallerIp: null,
        sample: {
          workflowId: WORKFLOW_ID,
          source: "webhook",
          payload: { plan: "pro" },
          variables: {
            variables: [{ path: "payload.plan", valueType: "string" }],
            notSupported: [],
            truncated: false,
          },
          updatedAt: "2026-11-13T10:00:00.000Z",
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

describe("useWorkflowWebhook", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the workflow's webhook, Sample payload Variables included, from the data envelope", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(webhookResponse());

    const { result } = renderHook(() => useWorkflowWebhook({ workflowId: WORKFLOW_ID, enabled: true }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.sample?.variables.variables).toEqual([
      { path: "payload.plan", valueType: "string" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v3/workflows/${WORKFLOW_ID}/webhook`,
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("asks for nothing when disabled, as for a read-only member who may not see the Secret URL", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useWorkflowWebhook({ workflowId: WORKFLOW_ID, enabled: false }), {
      wrapper: createWrapper(newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces a refused request as an error rather than a sample", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Forbidden", status: 403, detail: "No access" }), {
        status: 403,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    const { result } = renderHook(() => useWorkflowWebhook({ workflowId: WORKFLOW_ID, enabled: true }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
