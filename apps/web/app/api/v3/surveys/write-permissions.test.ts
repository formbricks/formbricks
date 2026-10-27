import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyEnding } from "@formbricks/types/surveys/types";
import { DEFAULT_ENDING_CARD_BUTTON_LINK } from "@/lib/survey/default-ending-card";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { V3SurveyWritePermissionError, assertV3SurveyWritePermissions } from "./write-permissions";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: vi.fn(),
}));

const endScreen = (buttonLink?: string): TSurveyEnding =>
  ({
    id: "clen1234567890123456789012",
    type: "endScreen",
    headline: { default: "Thanks" },
    ...(buttonLink ? { buttonLabel: { default: "Open" }, buttonLink } : {}),
  }) as TSurveyEnding;

describe("assertV3SurveyWritePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
  });

  test("allows re-enabling the default ending-card CTA without the external URL entitlement", async () => {
    await expect(
      assertV3SurveyWritePermissions(
        {
          workspaceId: "ws_1",
          blocks: [],
          endings: [endScreen(DEFAULT_ENDING_CARD_BUTTON_LINK)],
          previous: { blocks: [], endings: [endScreen()] },
        },
        "org_1"
      )
    ).resolves.toBeUndefined();
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
  });

  test("rejects a link that mimics the default CTA but changes its parameters", async () => {
    await expect(
      assertV3SurveyWritePermissions(
        {
          workspaceId: "ws_1",
          blocks: [],
          endings: [endScreen(`${DEFAULT_ENDING_CARD_BUTTON_LINK}&next=https://evil.example`)],
          previous: { blocks: [], endings: [endScreen(DEFAULT_ENDING_CARD_BUTTON_LINK)] },
        },
        "org_1"
      )
    ).rejects.toThrow(V3SurveyWritePermissionError);
  });
});
