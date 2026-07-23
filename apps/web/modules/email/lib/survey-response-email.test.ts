import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildSurveyResponseEmailHtml, resolveResponseRecipient } from "./survey-response-email";

const {
  mockRenderFollowUpEmail,
  mockGetElementResponseMapping,
  mockParseRecallInfo,
  mockResolveStorageUrl,
  mockGetTranslate,
} = vi.hoisted(() => ({
  mockRenderFollowUpEmail: vi.fn(),
  mockGetElementResponseMapping: vi.fn(),
  mockParseRecallInfo: vi.fn(),
  mockResolveStorageUrl: vi.fn(),
  mockGetTranslate: vi.fn(),
}));

vi.mock("@formbricks/email", () => ({
  renderFollowUpEmail: mockRenderFollowUpEmail,
}));

vi.mock("@/lib/responses", () => ({
  getElementResponseMapping: mockGetElementResponseMapping,
}));

vi.mock("@/lib/utils/recall", () => ({
  parseRecallInfo: mockParseRecallInfo,
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrl: mockResolveStorageUrl,
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: mockGetTranslate,
}));

const response = {
  id: "cm9zr4rsp000708l8bqccpfrx",
  surveyId: "cm9zr4mps000008l8btfy1vtz",
  data: { email: "jane@example.com", name: "Jane", utm: "newsletter" },
  variables: { var1: "pro" },
  language: "en-US",
} as unknown as TResponse;

const survey = {
  id: "cm9zr4mps000008l8btfy1vtz",
  blocks: [],
  languages: [],
  variables: [{ id: "var1", name: "plan", type: "text" }],
  hiddenFields: { enabled: true, fieldIds: ["utm"] },
} as unknown as TSurvey;

describe("resolveResponseRecipient", () => {
  test("uses a literal email `to` directly", () => {
    expect(resolveResponseRecipient("teammate@example.com", response)).toEqual({
      ok: true,
      email: "teammate@example.com",
    });
  });

  test("resolves a question/hidden-field id to a string email in the response", () => {
    expect(resolveResponseRecipient("email", response)).toEqual({ ok: true, email: "jane@example.com" });
  });

  test("resolves a contact-info array element using index [2]", () => {
    const contactResponse = {
      ...response,
      data: { contact: ["Jane", "Doe", "jane@example.com", "+123"] },
    } as unknown as TResponse;
    expect(resolveResponseRecipient("contact", contactResponse)).toEqual({
      ok: true,
      email: "jane@example.com",
    });
  });

  test("fails when the id is missing from the response data", () => {
    const result = resolveResponseRecipient("missing", response);
    expect(result.ok).toBe(false);
  });

  test("fails when the resolved string is not a valid email", () => {
    const badResponse = { ...response, data: { email: "not-an-email" } } as unknown as TResponse;
    const result = resolveResponseRecipient("email", badResponse);
    expect(result.ok).toBe(false);
  });

  test("fails when the contact-info array has no email at index [2]", () => {
    const contactResponse = { ...response, data: { contact: ["Jane", "Doe"] } } as unknown as TResponse;
    const result = resolveResponseRecipient("contact", contactResponse);
    expect(result.ok).toBe(false);
  });
});

describe("buildSurveyResponseEmailHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranslate.mockResolvedValue((key: string) => key);
    mockRenderFollowUpEmail.mockResolvedValue("<html>rendered</html>");
    mockParseRecallInfo.mockImplementation((body: string) => body);
    mockGetElementResponseMapping.mockReturnValue([]);
    mockResolveStorageUrl.mockImplementation((url: string) => `https://cdn.example.com/${url}`);
  });

  test("sanitizes the recall-parsed body before rendering (drops disallowed markup)", async () => {
    mockParseRecallInfo.mockReturnValue('<p>Hi Jane</p><script>alert("x")</script><img src=x>');

    await buildSurveyResponseEmailHtml({
      body: "#recall:name/fallback:there#",
      survey,
      response,
      attachResponseData: false,
    });

    expect(mockParseRecallInfo).toHaveBeenCalledWith(
      "#recall:name/fallback:there#",
      response.data,
      response.variables
    );
    const rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.body).toBe("<p>Hi Jane</p>");
    expect(rendered.body).not.toContain("<script>");
    expect(rendered.body).not.toContain("<img");
  });

  test("omits response data / variables / hidden fields when attachResponseData is off", async () => {
    await buildSurveyResponseEmailHtml({
      body: "Body",
      survey,
      response,
      attachResponseData: false,
      includeVariables: true,
      includeHiddenFields: true,
    });

    const rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.responseData).toEqual([]);
    expect(rendered.variables).toEqual([]);
    expect(rendered.hiddenFields).toEqual([]);
    expect(mockGetElementResponseMapping).not.toHaveBeenCalled();
  });

  test("includes response data and resolves storage URLs for file/picture elements", async () => {
    mockGetElementResponseMapping.mockReturnValue([
      { element: "Upload", response: ["file1.png"], type: TSurveyElementTypeEnum.FileUpload },
      { element: "Name", response: "Jane", type: TSurveyElementTypeEnum.OpenText },
    ]);

    await buildSurveyResponseEmailHtml({
      body: "Body",
      survey,
      response,
      attachResponseData: true,
    });

    const rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.responseData).toEqual([
      {
        element: "Upload",
        response: ["https://cdn.example.com/file1.png"],
        type: TSurveyElementTypeEnum.FileUpload,
      },
      { element: "Name", response: "Jane", type: TSurveyElementTypeEnum.OpenText },
    ]);
  });

  test("gates variables behind includeVariables and hidden fields behind includeHiddenFields", async () => {
    const withVars = await buildSurveyResponseEmailHtml({
      body: "Body",
      survey,
      response,
      attachResponseData: true,
      includeVariables: true,
      includeHiddenFields: false,
    });
    expect(withVars).toBe("<html>rendered</html>");

    let rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.variables).toEqual([{ id: "var1", name: "plan", type: "text", value: "pro" }]);
    expect(rendered.hiddenFields).toEqual([]);

    mockRenderFollowUpEmail.mockClear();

    await buildSurveyResponseEmailHtml({
      body: "Body",
      survey,
      response,
      attachResponseData: true,
      includeVariables: false,
      includeHiddenFields: true,
    });
    rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.variables).toEqual([]);
    expect(rendered.hiddenFields).toEqual([{ id: "utm", value: "newsletter" }]);
  });

  test("falls back to the default locale when none is provided", async () => {
    await buildSurveyResponseEmailHtml({ body: "Body", survey, response, attachResponseData: false });
    expect(mockGetTranslate).toHaveBeenCalledWith("en-US");
  });
});
