/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { responseCardKeys } from "../lib/query";
import { useResponseCard } from "./use-response-card";

const RESPONSE_ID = "clresp1111111111111111111";
const CREATED_AT = "2026-10-01T10:00:00.000Z";

describe("useResponseCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads nothing until a response is picked", () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useResponseCard(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("reads the picked response into its own cache entry", async () => {
    routeFetch({
      [`GET /api/internal/responses/${RESPONSE_ID}`]: [
        json({ data: { id: RESPONSE_ID, createdAt: CREATED_AT, updatedAt: CREATED_AT, tags: [] } }),
      ],
    });
    const { wrapper, queryClient } = createQueryWrapper();

    const { result } = renderHook(() => useResponseCard(RESPONSE_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.createdAt).toEqual(new Date(CREATED_AT));
    expect(queryClient.getQueryData(responseCardKeys.detail(RESPONSE_ID))).toBe(result.current.data);
  });

  test("reports a refusal as an error", async () => {
    routeFetch({
      [`GET /api/internal/responses/${RESPONSE_ID}`]: [
        json({ status: 403, detail: "You are not authorized to access this resource" }, 403),
      ],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useResponseCard(RESPONSE_ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
  });
});
