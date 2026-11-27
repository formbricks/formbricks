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

  test("reads an attribute's values through the editor's workspace", async () => {
    routeFetch({
      [`GET /api/internal/contact-attribute-keys/${KEY_ID}/values?workspaceId=${WORKSPACE_ID}`]: [
        json({ data: ["pro"] }),
      ],
    });

    const { result } = renderHook(() => useContactAttributeKeyValues(KEY_ID, WORKSPACE_ID), {
      wrapper: createQueryWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["pro"]);
  });

  test.each([
    ["an attribute key", "", WORKSPACE_ID],
    ["a workspace", KEY_ID, undefined],
  ])("asks nothing until there is %s", (_label, keyId, workspaceId) => {
    const { result } = renderHook(() => useContactAttributeKeyValues(keyId, workspaceId), {
      wrapper: createQueryWrapper().wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("reads the surveys a survey-interaction filter can name, and which named ids are elsewhere", async () => {
    const OTHER_SURVEY_ID = "clother1111111111111111111";
    const data = {
      surveys: [{ id: "clsurvey11111111111111111", name: "Onboarding", status: "inProgress" }],
      otherWorkspaceSurveyIds: [OTHER_SURVEY_ID],
    };
    routeFetch({
      [`GET /api/internal/workspaces/${WORKSPACE_ID}/segment-filter-surveys?surveyIds=${OTHER_SURVEY_ID}`]: [
        json({ data }),
      ],
    });

    const { result } = renderHook(() => useSegmentFilterSurveys(WORKSPACE_ID, [OTHER_SURVEY_ID]), {
      wrapper: createQueryWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });
});
