import { beforeEach, describe, expect, test, vi } from "vitest";
import { deriveLegacyEmbeddedData } from "@formbricks/types/embedded-data-resolver";
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
  // The rows are what the accessors read since ENG-2412; a real survey read carries both.
  embeddedFields: deriveLegacyEmbeddedData({
    variables: [{ id: "var1", name: "plan", type: "text", value: "" }],
    hiddenFields: { enabled: true, fieldIds: ["utm"] },
  }),
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

  const sanitizedBodyOf = (html: string): Promise<string> => {
    mockParseRecallInfo.mockReturnValue(html);
    return buildSurveyResponseEmailHtml({
      body: "irrelevant",
      survey,
      response,
      attachResponseData: false,
    }).then(() => mockRenderFollowUpEmail.mock.calls[0][0].body as string);
  };

  test("sanitizes the recall-parsed body before rendering (drops disallowed markup)", async () => {
    mockParseRecallInfo.mockReturnValue('<p>Hi Jane</p><script>alert("x")</script><img src=x>');

    await buildSurveyResponseEmailHtml({
      body: "#recall:name/fallback:there#",
      survey,
      response,
      attachResponseData: false,
    });

    // The trailing `true` is `escapeValues`: recall values are escaped as they are substituted. The
    // allowlist below permits `<a href>` for author-written body HTML, so without escaping a
    // respondent could smuggle a clickable link through an open-text answer into an owner-facing
    // email. The locale is passed explicitly so recalled date answers aren't formatted as en-US.
    //
    // The lookup map is `buildServerEmbeddedValues(response, survey)`, not `response.data`
    // (ENG-2538): a reserved token in a notification body used to render its fallback here while
    // resolving correctly in the live survey. Asserted as a superset — every answer still reachable,
    // plus the reserved values — rather than a literal object, so a catalog addition (ENG-1858) does
    // not fail this test for saying nothing about sanitization.
    expect(mockParseRecallInfo).toHaveBeenCalledWith(
      "#recall:name/fallback:there#",
      expect.objectContaining({ ...response.data, responseId: response.id, surveyId: response.surveyId }),
      response.variables,
      false,
      "en-US",
      undefined,
      true
    );
    // The declared answers are not merely present, they still WIN: `name` is the respondent's, and
    // nothing reserved may overwrite it.
    expect(mockParseRecallInfo.mock.calls[0][1]).toMatchObject(response.data);
    const rendered = mockRenderFollowUpEmail.mock.calls[0][0];
    expect(rendered.body).toBe("<p>Hi Jane</p>");
    expect(rendered.body).not.toContain("<script>");
    expect(rendered.body).not.toContain("<img");
  });

  // Lists used to be stripped while their items were kept, so "1. Banana / 2. Mango" arrived as
  // "BananaMango" on a single line.
  test("keeps ordered list structure and numbering", async () => {
    const body = await sanitizedBodyOf(
      '<p class="fb-editor-paragraph">What I eat in a day</p>' +
        '<ol class="fb-editor-list-ol" start="2">' +
        '<li value="2" class="fb-editor-listitem"><span>Banana</span></li>' +
        '<li value="3" class="fb-editor-listitem"><span>Mango</span></li>' +
        "</ol>"
    );

    expect(body).toBe(
      '<p class="fb-editor-paragraph">What I eat in a day</p>' +
        '<ol class="fb-editor-list-ol" start="2">' +
        '<li value="2" class="fb-editor-listitem"><span>Banana</span></li>' +
        '<li value="3" class="fb-editor-listitem"><span>Mango</span></li>' +
        "</ol>"
    );
  });

  test("keeps unordered and nested list structure", async () => {
    const body = await sanitizedBodyOf("<ul><li>Fruit<ul><li>Banana</li></ul></li><li>Bread</li></ul>");

    expect(body).toBe("<ul><li>Fruit<ul><li>Banana</li></ul></li><li>Bread</li></ul>");
  });

  test("keeps inline formatting and links inside list items", async () => {
    const body = await sanitizedBodyOf(
      "<ul><li><b><strong>bold</strong></b> <i><em>italic</em></i><br />" +
        '<a href="https://formbricks.com">link</a></li></ul>'
    );

    expect(body).toBe(
      "<ul><li><b><strong>bold</strong></b> <i><em>italic</em></i><br />" +
        '<a href="https://formbricks.com">link</a></li></ul>'
    );
  });

  test("keeps http(s) links but drops other schemes, inline styles and event handlers", async () => {
    const body = await sanitizedBodyOf(
      '<p style="color:red" onclick="steal()">' +
        '<a href="https://formbricks.com" target="_blank" rel="noopener">ok</a>' +
        '<a href="javascript:alert(1)">bad</a>' +
        "</p>"
    );

    expect(body).toBe(
      '<p><a href="https://formbricks.com" target="_blank" rel="noopener">ok</a><a>bad</a></p>'
    );
  });

  test("still discards embedded, scripted and layout markup", async () => {
    const body = await sanitizedBodyOf(
      "<script>alert(1)</script><style>p{}</style><iframe src=x></iframe>" +
        '<img src="x" onerror="alert(1)" /><table><tr><td>cell</td></tr></table>'
    );

    expect(body).not.toMatch(/<(script|style|iframe|img|table|tr|td)\b/);
    expect(body).not.toContain("onerror");
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
