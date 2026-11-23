/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SAMPLE_SAVE_DELAY_MS, type TSaveJsonSample, useJsonSampleDraft } from "./use-json-sample-draft";

/** A save that stays in flight until the test finishes it, like a request waiting on the server. */
const setup = () => {
  const pending: { payload: Record<string, unknown>; finish: () => void }[] = [];
  const saveSample = vi.fn<TSaveJsonSample>((payload, { onSuccess }) => {
    pending.push({ payload, finish: onSuccess });
  });
  const { result } = renderHook(() => useJsonSampleDraft(saveSample));
  const type = (text: string) => {
    act(() => result.current.edit(text));
  };
  const waitForSave = () => {
    act(() => {
      vi.advanceTimersByTime(SAMPLE_SAVE_DELAY_MS);
    });
  };
  const finishSave = (index = 0) => {
    act(() => pending[index].finish());
  };
  return { result, saveSample, type, waitForSave, finishSave };
};

describe("useJsonSampleDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps the typed text in the editor after it saves", () => {
    const { result, saveSample, type, waitForSave, finishSave } = setup();
    const typed = '{"email": "a@b.co", "name": "Jo"}';

    type(typed);
    expect(result.current.hasUnsavedEdit).toBe(true);
    waitForSave();
    expect(saveSample).toHaveBeenCalledWith({ email: "a@b.co", name: "Jo" }, expect.anything());
    finishSave();

    // Not swapped for the stored copy, which comes back reformatted with its keys reordered.
    expect(result.current.draft).toBe(typed);
    expect(result.current.hasUnsavedEdit).toBe(false);
  });

  test("keeps what was typed while a save was in flight, and saves it next", () => {
    const { result, saveSample, type, waitForSave, finishSave } = setup();

    type('{"a": 1}');
    waitForSave();
    type('{"a": 12}');
    finishSave();

    expect(result.current.draft).toBe('{"a": 12}');
    expect(result.current.hasUnsavedEdit).toBe(true);
    waitForSave();
    expect(saveSample).toHaveBeenLastCalledWith({ a: 12 }, expect.anything());
  });

  test("saves once typing stops, with the last text", () => {
    const { saveSample, type, waitForSave } = setup();

    type('{"a": 1}');
    type('{"a": 1, "b": 2}');
    waitForSave();

    expect(saveSample).toHaveBeenCalledTimes(1);
    expect(saveSample).toHaveBeenCalledWith({ a: 1, b: 2 }, expect.anything());
  });

  test("doesn't save text that isn't a JSON object", () => {
    const { result, saveSample, type, waitForSave } = setup();

    type('{"a": ');
    waitForSave();

    expect(saveSample).not.toHaveBeenCalled();
    expect(result.current.hasUnsavedEdit).toBe(false);
  });

  test("a sample chosen outside the editor replaces the typed text and cancels its save", () => {
    const { result, saveSample, type, waitForSave, finishSave } = setup();
    const onSaved = vi.fn();

    type('{"typed": true}');
    act(() => result.current.save({ fromCall: true }, onSaved));
    waitForSave();
    finishSave();

    expect(saveSample).toHaveBeenCalledTimes(1);
    expect(saveSample).toHaveBeenCalledWith({ fromCall: true }, expect.anything());
    expect(result.current.draft).toBeNull();
    expect(onSaved).toHaveBeenCalled();
  });
});
