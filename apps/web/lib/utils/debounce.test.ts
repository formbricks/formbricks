import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("calls back once, with the last arguments, after the calls stop for the delay", () => {
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounce(callback, 100);

    debounced("a");
    vi.advanceTimersByTime(99);
    debounced("b");
    vi.advanceTimersByTime(99);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("b");
  });

  test("cancel drops the pending call", () => {
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounce(callback, 100);

    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
  });

  test("cancel with nothing pending does nothing, and later calls still go through", () => {
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounce(callback, 100);

    debounced.cancel();
    debounced("a");
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledWith("a");
  });
});
