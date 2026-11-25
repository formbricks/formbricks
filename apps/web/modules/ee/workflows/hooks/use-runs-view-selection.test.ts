/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useRunsViewSelection } from "./use-runs-view-selection";

const runsPath = "/workspaces/ws1/workflows/wf1/runs";

vi.mock("next/navigation", () => ({
  usePathname: () => runsPath,
  useSearchParams: () => new URLSearchParams(globalThis.window.location.search),
  useRouter: () => ({
    replace: (url: string) => {
      const basePath = globalThis.window.location.pathname.startsWith("/formbricks/") ? "/formbricks" : "";
      globalThis.window.history.replaceState(null, "", `${basePath}${url}`);
    },
  }),
}));

beforeEach(() => {
  globalThis.window.history.replaceState(null, "", `${runsPath}?step=trigger`);
});

test("keeps the new Test run when All steps clears the step before a rerender", () => {
  const { result, rerender } = renderHook(useRunsViewSelection);

  act(() => {
    result.current.showRun("test-run");
    result.current.selectStep(null);
  });
  rerender();

  expect(result.current.urlRunId).toBe("test-run");
  expect(result.current.selectedStepId).toBeNull();
});

test("keeps a newly selected step when the Test run finishes before a rerender", () => {
  const { result, rerender } = renderHook(useRunsViewSelection);

  act(() => {
    result.current.selectStep("email");
    result.current.showRun("test-run");
  });
  rerender();

  expect(result.current.urlRunId).toBe("test-run");
  expect(result.current.selectedStepId).toBe("email");
});

test("preserves the deployment prefix, unrelated URL state, and history length", () => {
  const url = `/formbricks${runsPath}?run=previous&step=trigger&tab=all#panel`;
  globalThis.window.history.replaceState(null, "", url);
  const historyLength = globalThis.window.history.length;
  const { result } = renderHook(useRunsViewSelection);

  act(() => result.current.showRun("test-run"));

  const { pathname, searchParams, hash } = new URL(globalThis.window.location.href);
  expect(pathname).toBe(`/formbricks${runsPath}`);
  expect(Object.fromEntries(searchParams)).toEqual({ run: "test-run", step: "trigger", tab: "all" });
  expect(hash).toBe("#panel");
  expect(globalThis.window.history).toHaveLength(historyLength);
});
