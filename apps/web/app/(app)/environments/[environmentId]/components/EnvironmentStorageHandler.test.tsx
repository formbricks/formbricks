import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import EnvironmentStorageHandler from "./EnvironmentStorageHandler";

describe("EnvironmentStorageHandler", () => {
  test("sets environmentId in localStorage on mount", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const testEnvironmentId = "test-env-123";

    render(<EnvironmentStorageHandler environmentId={testEnvironmentId} />);

    expect(setItemSpy).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS, testEnvironmentId);
    setItemSpy.mockRestore();
  });

  test("updates environmentId in localStorage when prop changes", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const initialEnvironmentId = "test-env-initial";
    const updatedEnvironmentId = "test-env-updated";

    const { rerender } = render(<EnvironmentStorageHandler environmentId={initialEnvironmentId} />);

    expect(setItemSpy).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS, initialEnvironmentId);

    rerender(<EnvironmentStorageHandler environmentId={updatedEnvironmentId} />);

    expect(setItemSpy).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS, updatedEnvironmentId);
    expect(setItemSpy).toHaveBeenCalledTimes(2); // Called on mount and on rerender with new prop

    setItemSpy.mockRestore();
  });
});
