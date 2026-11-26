/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { useContactAttributeKeyValues, useSegmentFilterSurveys } from "./use-segment-editor-options";

const KEY_ID = "clkey11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";

describe("segment editor option hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads an attribute's values", async () => {
    routeFetch({ [`GET /api/internal/contact-attribute-keys/${KEY_ID}/values`]: [json({ data: ["pro"] })] });

    const { result } = renderHook(() => useContactAttributeKeyValues(KEY_ID), {
      wrapper: createQueryWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["pro"]);
  });

  test("asks nothing until there is an attribute key", () => {
    const { result } = renderHook(() => useContactAttributeKeyValues(""), {
      wrapper: createQueryWrapper().wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("reads the surveys a survey-interaction filter can name", async () => {
    const surveys = [{ id: "clsurvey11111111111111111", name: "Onboarding", status: "inProgress" }];
    routeFetch({
      [`GET /api/internal/workspaces/${WORKSPACE_ID}/segment-filter-surveys`]: [json({ data: surveys })],
    });

    const { result } = renderHook(() => useSegmentFilterSurveys(WORKSPACE_ID), {
      wrapper: createQueryWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(surveys);
  });
});
