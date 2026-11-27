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

const endScreen = (buttonLink?: string): TSurveyEnding => ({
  id: "clen1234567890123456789012",
  type: "endScreen",
  headline: { default: "Thanks" },
  ...(buttonLink ? { buttonLabel: { default: "Open" }, buttonLink } : {}),
});

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

  // The stored survey is not re-validated: a block saved as a draft, or by the raw-SQL questions →
  // blocks migration, can lack `elements` (ENG-2497).
  test("checks a survey whose stored version has a block with no elements array", async () => {
    const cta = {
      id: "cta1",
      type: "cta",
      headline: { default: "Visit us" },
      required: false,
      buttonExternal: true,
      buttonUrl: "https://example.com",
      ctaButtonLabel: { default: "Go" },
    };
    const ctaBlock = { id: "blk2", name: "Block 2", elements: [cta] };

    await expect(
      assertV3SurveyWritePermissions(
        {
          workspaceId: "ws_1",
          blocks: [ctaBlock] as never,
          endings: [],
          previous: { blocks: [{ id: "blk1", name: "Block 1" }, ctaBlock] as never, endings: [] },
        },
        "org_1"
      )
    ).resolves.toBeUndefined();
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
  });

  // ENG-3891: a PATCH could otherwise add the link a create is refused.
  describe("links in rich text", () => {
    const blockWithHeadline = (html: string) =>
      [
        {
          id: "blk1",
          name: "Block 1",
          elements: [{ id: "q1", type: "openText", headline: { default: html }, required: false }],
        },
      ] as never;
    const LINKED = '<p>See <a href="https://example.com/terms">terms</a></p>';

    test("rejects a headline that gains a link", async () => {
      await expect(
        assertV3SurveyWritePermissions(
          {
            workspaceId: "ws_1",
            blocks: blockWithHeadline(LINKED),
            endings: [],
            previous: { blocks: blockWithHeadline("<p>See terms</p>"), endings: [] },
          },
          "org_1"
        )
      ).rejects.toThrow(V3SurveyWritePermissionError);
    });

    // The survey escapes recalled values (ENG-7270), so a link-shaped value is shown as text, not a link.
    test("allows a text variable whose new value looks like a link, which the survey shows as text", async () => {
      const variableId = "clvar1234567890123456789012";
      const blocks = blockWithHeadline(`<p>#recall:${variableId}/fallback:x#</p>`);
      const variable = (value: string) => [{ id: variableId, name: "v1", type: "text" as const, value }];
      await expect(
        assertV3SurveyWritePermissions(
          {
            workspaceId: "ws_1",
            blocks,
            endings: [],
            variables: variable(LINKED),
            previous: { blocks, endings: [], variables: variable("friend") },
          },
          "org_1"
        )
      ).resolves.toBeUndefined();
    });

    // Escaping keeps markup out, not a URL out of an attribute the template already opens.
    test("rejects a text variable whose new value completes a link attribute in the template", async () => {
      const variableId = "clvar1234567890123456789012";
      const blocks = blockWithHeadline(
        `<p><a h#recall:${variableId}/fallback:x#="https://example.com/a">go</a></p>`
      );
      const variable = (value: string) => [{ id: variableId, name: "v1", type: "text" as const, value }];
      await expect(
        assertV3SurveyWritePermissions(
          {
            workspaceId: "ws_1",
            blocks,
            endings: [],
            variables: variable("ref"),
            previous: { blocks, endings: [], variables: variable("friend") },
          },
          "org_1"
        )
      ).rejects.toThrow(V3SurveyWritePermissionError);
    });

    test("rejects a welcome card that gains a link", async () => {
      const welcomeCard = {
        enabled: true,
        headline: { default: "Hi" },
        timeToFinish: false,
        showResponseCount: false,
      };
      await expect(
        assertV3SurveyWritePermissions(
          {
            workspaceId: "ws_1",
            blocks: [],
            endings: [],
            welcomeCard: { ...welcomeCard, subheader: { default: LINKED } },
            previous: { blocks: [], endings: [], welcomeCard },
          },
          "org_1"
        )
      ).rejects.toThrow(V3SurveyWritePermissionError);
    });

    test("keeps a link the survey already had without asking the plan", async () => {
      await expect(
        assertV3SurveyWritePermissions(
          {
            workspaceId: "ws_1",
            blocks: blockWithHeadline(`${LINKED}<p>Edited</p>`),
            endings: [],
            previous: { blocks: blockWithHeadline(LINKED), endings: [] },
          },
          "org_1"
        )
      ).resolves.toBeUndefined();
      expect(getExternalUrlsPermission).not.toHaveBeenCalled();
    });
  });
});
