/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useDeferredPick } from "./use-deferred-pick";

const setup = (selected: string[] = []) => {
  const onApply = vi.fn();
  const hook = renderHook(({ value }) => useDeferredPick(value, onApply), {
    initialProps: { value: selected },
  });
  return { onApply, hook };
};

describe("useDeferredPick", () => {
  test("ticking values changes the draft only; the pick is applied once, when the list closes", () => {
    const { onApply, hook } = setup();

    act(() => hook.result.current.toggle("Web"));
    act(() => hook.result.current.toggle("App"));
    act(() => hook.result.current.toggle("Web"));
    expect(hook.result.current.draft).toEqual(["App"]);
    expect(onApply).not.toHaveBeenCalled();

    act(() => hook.result.current.apply());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(["App"]);
  });

  test("closing without a change applies nothing, so no chart reloads and no history entry is added", () => {
    const { onApply, hook } = setup(["Web"]);
    act(() => hook.result.current.toggle("App"));
    act(() => hook.result.current.toggle("App"));
    act(() => hook.result.current.apply());
    expect(onApply).not.toHaveBeenCalled();
  });

  test("the draft follows a pick changed from outside (the chip's ×, back/forward)", () => {
    const { hook } = setup(["Web"]);
    hook.rerender({ value: [] });
    expect(hook.result.current.draft).toEqual([]);
  });

  test("a hundred ticks still apply once", () => {
    const { onApply, hook } = setup();
    act(() => {
      for (let index = 0; index < 100; index += 1) hook.result.current.toggle(`v${index}`);
    });
    act(() => hook.result.current.apply());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toHaveLength(100);
  });
});
