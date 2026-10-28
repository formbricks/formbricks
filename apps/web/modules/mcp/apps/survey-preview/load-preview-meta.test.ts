import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSurveyWithCustomCss } from "@/lib/survey/service";
import { getLinkSurveyCustomCss } from "@/modules/survey/link/lib/respondent-custom-css";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { loadSurveyPreviewMeta } from "./load-preview-meta";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({ APP_RELEASE_VERSION: "5.1.0" }));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://surveys.example.com" }));
vi.mock("@/lib/survey/service", () => ({ getSurveyWithCustomCss: vi.fn() }));
vi.mock("@/modules/survey/link/lib/respondent-custom-css", () => ({ getLinkSurveyCustomCss: vi.fn() }));
vi.mock("@/modules/survey/link/lib/workspace", () => ({ getWorkspaceContextForLinkSurvey: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const survey = {
  id: "clsurvey1",
  name: "Feedback",
  type: "link",
  status: "inProgress",
  workspaceId: "clworkspace1",
  welcomeCard: { enabled: false },
  questions: [],
  blocks: [{ id: "b1", name: "One", elements: [] }],
  endings: [],
  variables: [],
  hiddenFields: { enabled: false },
  languages: [],
  triggers: [],
  styling: null,
  segment: null,
  pin: "1234",
  displayOption: "displayOnce",
  delay: 0,
  isVerifyEmailEnabled: false,
  isBackButtonHidden: false,
  singleUse: null,
};

const workspaceContext = {
  workspace: { styling: { allowStyleOverwrite: true }, linkSurveyBranding: true },
  customCss: null,
};

const args = { surveyId: "clsurvey1", expectedWorkspaceId: "clworkspace1", requestId: "req_1" };

describe("loadSurveyPreviewMeta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSurveyWithCustomCss).mockResolvedValue(survey as never);
    vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue(workspaceContext as never);
    vi.mocked(getLinkSurveyCustomCss).mockResolvedValue({ workspace: { light: "a{}" } });
  });

  test("builds the renderer data from the stored survey and the workspace, without the PIN", async () => {
    const meta = await loadSurveyPreviewMeta(args);

    expect(getWorkspaceContextForLinkSurvey).toHaveBeenCalledWith("clworkspace1");
    expect(meta?.rendererUrl).toBe("https://surveys.example.com/js/surveys.umd.cjs?v=5.1.0");
    expect(meta?.render.customCss).toEqual({ workspace: { light: "a{}" } });
    expect(JSON.stringify(meta)).not.toContain("1234");
  });

  test("builds nothing for a survey outside the workspace the authorized read answered for", async () => {
    expect(await loadSurveyPreviewMeta({ ...args, expectedWorkspaceId: "another" })).toBeNull();
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("returns null instead of throwing when loading fails", async () => {
    vi.mocked(getWorkspaceContextForLinkSurvey).mockRejectedValue(new Error("database down"));
    expect(await loadSurveyPreviewMeta(args)).toBeNull();
  });

  test("returns null for a survey that is gone", async () => {
    vi.mocked(getSurveyWithCustomCss).mockResolvedValue(null);
    expect(await loadSurveyPreviewMeta(args)).toBeNull();
  });
});
