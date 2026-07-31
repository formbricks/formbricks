import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

/**
 * Shared renderHook harness for the workflows hook tests: a provider wrapper bound to the given
 * QueryClient, and a no-retry client factory so failure paths reject immediately instead of
 * retrying into the test timeout.
 */
export function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "WorkflowsHookTestWrapper";
  return Wrapper;
}

export const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
