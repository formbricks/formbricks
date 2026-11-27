/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { useFileUploadLimit } from "./use-file-upload-limit";

const WORKSPACE_ID = "clws111111111111111111111";
const LIMIT_URL = `GET /api/internal/workspaces/${WORKSPACE_ID}/file-upload-limit`;

describe("useFileUploadLimit", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the workspace's file size cap", async () => {
    routeFetch({ [LIMIT_URL]: [json({ data: { maxFileSizeMB: 1024 } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useFileUploadLimit(WORKSPACE_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ maxFileSizeMB: 1024 });
  });

  test("reports a refusal without retrying it", async () => {
    routeFetch({
      [LIMIT_URL]: [json({ status: 403, title: "Forbidden", detail: "Forbidden" }, 403)],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useFileUploadLimit(WORKSPACE_ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
