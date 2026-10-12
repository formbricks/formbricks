/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TCustomCssDraft } from "../lib/draft";
import { useCustomCssValidation } from "./use-custom-css-validation";

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "useCustomCssValidationTestWrapper";
  return Wrapper;
};

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });

const valid = (light: string) => ({
  valid: true,
  operation: "customCss",
  invalid_params: [],
  customCss: { light, dark: null },
  warnings: [],
});

/** Holds every validate request open until the test answers it, keyed by the draft's light source. */
const deferredFetch = () => {
  const pending = new Map<string, (response: Response) => void>();
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const light = JSON.parse(String(init.body)).data.customCss.light as string;
    return new Promise<Response>((resolve) => pending.set(light, resolve));
  });
  const respond = async (light: string, data: unknown) => {
    await act(async () => {
      pending.get(light)?.(jsonResponse(data));
    });
  };
  return { fetchMock, pending, respond };
};

const draft = (light: string): TCustomCssDraft => ({ light, dark: "" });

const render = (initial: TCustomCssDraft) =>
  renderHook(
    ({ value }: { value: TCustomCssDraft }) =>
      useCustomCssValidation({ workspaceId: "ws_1", scope: "workspace", draft: value, enabled: true }),
    {
      initialProps: { value: initial },
      wrapper: wrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    }
  );

describe("useCustomCssValidation", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("previews only the compiled CSS the server returned for the current draft", async () => {
    const { fetchMock, pending, respond } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = render(draft("a{}"));
    expect(result.current.status).toBe("pending");
    expect(result.current.previewCss).toBeNull();

    await waitFor(() => expect(pending.has("a{}")).toBe(true));
    await respond("a{}", valid("compiled-a"));

    await waitFor(() => expect(result.current.status).toBe("valid"));
    expect(result.current.previewCss).toEqual({ light: "compiled-a" });
  });

  test("a late answer for an older draft never replaces the current preview", async () => {
    const { fetchMock, pending, respond } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = render(draft("a{}"));
    await waitFor(() => expect(pending.has("a{}")).toBe(true));

    rerender({ value: draft("b{}") });
    await waitFor(() => expect(pending.has("b{}")).toBe(true));

    // The older draft answers first, while the current one is still pending: nothing changes.
    await respond("a{}", valid("compiled-a"));
    expect(result.current.status).toBe("pending");
    expect(result.current.previewCss).toBeNull();

    await respond("b{}", valid("compiled-b"));
    await waitFor(() => expect(result.current.previewCss).toEqual({ light: "compiled-b" }));
    expect(result.current.status).toBe("valid");
  });

  test("keeps the last valid preview while a draft is invalid, and says the preview is behind", async () => {
    const { fetchMock, pending, respond } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = render(draft("a{}"));
    await waitFor(() => expect(pending.has("a{}")).toBe(true));
    await respond("a{}", valid("compiled-a"));
    await waitFor(() => expect(result.current.status).toBe("valid"));

    rerender({ value: draft("a{") });
    await waitFor(() => expect(pending.has("a{")).toBe(true));
    await respond("a{", {
      valid: false,
      operation: "customCss",
      invalid_params: [],
      errors: [
        { code: "syntax_error", scope: "workspace", appearance: "light", line: 1, column: 3, reason: "x" },
      ],
    });

    await waitFor(() => expect(result.current.status).toBe("invalid"));
    expect(result.current.previewCss).toEqual({ light: "compiled-a" });
    expect(result.current.isPreviewBehind).toBe(true);
    expect(result.current.errors).toHaveLength(1);
  });

  test("checks an oversized draft locally, without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = render(draft("a".repeat(100_001)));

    expect(result.current.status).toBe("invalid");
    expect(result.current.errors[0]?.code).toBe("source_too_large");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an empty draft previews no CSS and sends nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = render(draft("   "));

    expect(result.current.status).toBe("empty");
    expect(result.current.previewCss).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
