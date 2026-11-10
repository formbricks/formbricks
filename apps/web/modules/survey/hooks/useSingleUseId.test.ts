/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { generateSingleUseLinks } from "@/modules/survey/list/lib/api-client";
import { useSingleUseId } from "./useSingleUseId";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));
vi.mock("@/modules/survey/list/lib/api-client", () => ({ generateSingleUseLinks: vi.fn() }));

const survey = (singleUse: TSurvey["singleUse"]) => ({ id: "survey1", singleUse }) as TSurvey;

describe("useSingleUseId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("mints one link with the survey's encryption setting and keeps it", async () => {
    vi.mocked(generateSingleUseLinks).mockResolvedValue([{ suId: "su1", suToken: "token1" }]);
    const { result } = renderHook(() => useSingleUseId(survey({ enabled: true, isEncrypted: true }), false));

    let link: unknown;
    await act(async () => {
      link = await result.current.refreshSingleUseId();
    });

    expect(link).toEqual({ suId: "su1", suToken: "token1" });
    expect(generateSingleUseLinks).toHaveBeenCalledWith({ surveyId: "survey1", isEncrypted: true, count: 1 });
    expect(result.current.singleUseId).toBe("su1");
    expect(result.current.singleUseToken).toBe("token1");
  });

  test("shows the server's reason when minting is refused", async () => {
    vi.mocked(generateSingleUseLinks).mockRejectedValue(
      new V3ApiError({ status: 403, detail: "You are not authorized to access this resource" })
    );
    const { result } = renderHook(() => useSingleUseId(survey({ enabled: true, isEncrypted: false }), false));

    await act(async () => {
      expect(await result.current.refreshSingleUseId()).toBeUndefined();
    });

    expect(toast.error).toHaveBeenCalledWith("You are not authorized to access this resource");
  });

  test.each([
    ["a read-only viewer", survey({ enabled: true, isEncrypted: false }), true],
    ["a survey without single-use links", survey({ enabled: false, isEncrypted: false }), false],
  ])("mints nothing for %s", async (_label, target, isReadOnly) => {
    const { result } = renderHook(() => useSingleUseId(target, isReadOnly));

    await act(async () => {
      expect(await result.current.refreshSingleUseId()).toBeUndefined();
    });

    expect(generateSingleUseLinks).not.toHaveBeenCalled();
  });
});
