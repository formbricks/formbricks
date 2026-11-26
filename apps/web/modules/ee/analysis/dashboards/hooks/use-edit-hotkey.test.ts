/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useEditHotkey } from "./use-edit-hotkey";

const pressE = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", cancelable: true }));

const setup = (state: {
  isReadOnly?: boolean;
  isEditing?: boolean;
  hasChanges?: boolean;
  isBusy?: boolean;
}) => {
  const onEnter = vi.fn();
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const hook = renderHook(() =>
    useEditHotkey({
      isReadOnly: false,
      isEditing: false,
      hasChanges: false,
      isBusy: false,
      ...state,
      onEnter,
      onSave,
      onCancel,
    })
  );
  return { ...hook, onEnter, onSave, onCancel };
};

describe("useEditHotkey", () => {
  test("enters edit mode from view mode", () => {
    const { onEnter, onSave, onCancel } = setup({});
    pressE();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("saves in edit mode when there is something to save, and cancels otherwise", () => {
    const saving = setup({ isEditing: true, hasChanges: true });
    pressE();
    expect(saving.onSave).toHaveBeenCalledTimes(1);
    saving.unmount();

    const cancelling = setup({ isEditing: true, hasChanges: false });
    pressE();
    expect(cancelling.onCancel).toHaveBeenCalledTimes(1);
  });

  test("does nothing for a read-only dashboard, and stops listening once unmounted", () => {
    const readOnly = setup({ isReadOnly: true });
    pressE();
    expect(readOnly.onEnter).not.toHaveBeenCalled();
    readOnly.unmount();

    const viewer = setup({});
    viewer.unmount();
    pressE();
    expect(viewer.onEnter).not.toHaveBeenCalled();
  });
});
