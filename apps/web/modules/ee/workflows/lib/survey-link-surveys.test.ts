import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getWorkflowSurveyLinkSurveys } from "./survey-link-surveys";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { survey: { findMany: vi.fn() } } }));

const link = (storageKey: string, source: "ingested" | "computed") => ({
  storageKey,
  embeddedData: {
    key: null,
    name: storageKey,
    source,
    dataType: "string",
    defaultValue: null,
    locked: false,
  },
});

describe("getWorkflowSurveyLinkSurveys", () => {
  beforeEach(() => vi.clearAllMocks());

  test("reports each survey by id: missing, not a link survey, or the passed-in keys its link accepts", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      {
        id: "s_link",
        type: "link",
        embeddedDataLinks: [
          link("agent_id", "ingested"),
          link("score", "computed"),
          link("lang", "ingested"),
        ],
      },
      { id: "s_app", type: "app", embeddedDataLinks: [link("plan", "ingested")] },
    ] as never);

    const checks = await getWorkflowSurveyLinkSurveys({
      workspaceId: "ws_1",
      surveyIds: ["s_link", "s_app", "s_gone"],
    });

    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]?.where).toEqual({
      id: { in: ["s_link", "s_app", "s_gone"] },
      workspaceId: "ws_1",
    });
    // `lang` is a parameter the link survey reads for itself, so a field of that name is never filled.
    expect(checks).toEqual([
      { surveyId: "s_link", status: "ok", acceptedEmbeddedDataKeys: ["agent_id"] },
      { surveyId: "s_app", status: "not_link", acceptedEmbeddedDataKeys: [] },
      { surveyId: "s_gone", status: "not_found", acceptedEmbeddedDataKeys: [] },
    ]);
  });
});
