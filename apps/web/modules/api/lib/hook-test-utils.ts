import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";
import { vi } from "vitest";

/**
 * Test helpers for TanStack Query hooks over the internal API client. Test-only: imported from
 * `*.test.ts` files, never from application code.
 */

/** A JSON response as the API sends it: `{ data }` on success, `problem+json` on failure, empty on 204. */
export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": status < 400 ? "application/json" : "application/problem+json" },
  });

const requestUrl = (input: string | URL | Request): string => {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
};

/**
 * Answer the stubbed global `fetch` by `"<METHOD> <url>"`. Each route answers in order and repeats its last
 * answer; a request nobody expected fails the test.
 */
export const routeFetch = (routes: Record<string, Response[]>) =>
  vi.mocked(global.fetch).mockImplementation((input, init) => {
    const url = requestUrl(input);
    const routeKey = `${init?.method ?? "GET"} ${url}`;
    const answers = routes[routeKey];
    if (!answers) return Promise.reject(new Error(`Unexpected request: ${routeKey}`));
    return Promise.resolve((answers.length > 1 ? answers.shift()! : answers[0]).clone());
  });

/** A fresh client with retries off, and a wrapper providing it to `renderHook`. */
export const createQueryWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "QueryTestWrapper";
  return { queryClient, wrapper: Wrapper };
};
