import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { attachSurveyPreview } from "./attach-preview";
import { loadSurveyPreviewMeta } from "./load-preview-meta";

vi.mock("./load-preview-meta", () => ({ loadSurveyPreviewMeta: vi.fn() }));

const survey = {
  id: "kj4a98xxat96iws9zmbrgj3a",
  workspaceId: "clw01234567890123456789012",
  name: "Customer feedback",
  type: "link",
  status: "draft",
  updatedAt: "2026-10-28T12:00:00.000Z",
  defaultLanguage: "en-US",
  blocks: [],
};

const written = (overrides: Partial<CallToolResult> = {}): CallToolResult => ({
  content: [{ type: "text", text: "{}" }],
  structuredContent: { data: survey, requestId: "req_1" },
  ...overrides,
});

const preview = { appUrl: "https://forms.example", rendererUrl: "https://forms.example/js/surveys.umd.cjs" };

describe("attachSurveyPreview", () => {
  beforeEach(() => {
    vi.mocked(loadSurveyPreviewMeta).mockReset();
    vi.mocked(loadSurveyPreviewMeta).mockResolvedValue(preview as never);
  });

  test("adds the render data to _meta.formbricks and leaves what the model reads alone", async () => {
    const result = written({ _meta: { other: 1 } });

    const attached = await attachSurveyPreview(result, "req_1");

    expect(attached._meta).toEqual({ other: 1, formbricks: preview });
    expect(attached.content).toBe(result.content);
    expect(attached.structuredContent).toBe(result.structuredContent);
    expect(loadSurveyPreviewMeta).toHaveBeenCalledWith({
      surveyId: survey.id,
      expectedWorkspaceId: survey.workspaceId,
      requestId: "req_1",
    });
  });

  test("siblings of data, such as custom CSS warnings, do not cost the preview", async () => {
    const withWarnings = written({
      structuredContent: { data: survey, warnings: [{ message: "removed @import" }], requestId: "req_1" },
    });

    expect((await attachSurveyPreview(withWarnings, "req_1"))._meta).toEqual({ formbricks: preview });
  });

  test("a failed write is returned untouched and loads nothing", async () => {
    const failed = written({ isError: true });

    expect(await attachSurveyPreview(failed, "req_1")).toBe(failed);
    expect(loadSurveyPreviewMeta).not.toHaveBeenCalled();
  });

  test("an answer that is not a whole survey (a concise projection) has no view to build", async () => {
    const concise = written({ structuredContent: { data: { id: survey.id, updatedAt: survey.updatedAt } } });

    expect(await attachSurveyPreview(concise, "req_1")).toBe(concise);
    expect(loadSurveyPreviewMeta).not.toHaveBeenCalled();
  });

  test("a preview that cannot be built leaves the plain result", async () => {
    vi.mocked(loadSurveyPreviewMeta).mockResolvedValue(null);
    const result = written();

    expect(await attachSurveyPreview(result, "req_1")).toBe(result);
  });
});
