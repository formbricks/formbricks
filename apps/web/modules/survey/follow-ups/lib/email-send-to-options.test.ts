import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  type EmailSendToOption,
  buildEmailSendToOptions,
  findEmailSendToOption,
} from "./email-send-to-options";

const { mockGetElementsFromBlocks, mockRecallToHeadline, mockGetTextContent } = vi.hoisted(() => ({
  mockGetElementsFromBlocks: vi.fn(),
  mockRecallToHeadline: vi.fn(),
  mockGetTextContent: vi.fn(),
}));

vi.mock("@/modules/survey/lib/client-utils", () => ({
  getElementsFromBlocks: mockGetElementsFromBlocks,
}));

vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: mockRecallToHeadline,
}));

vi.mock("@formbricks/types/surveys/validation", () => ({
  getTextContent: mockGetTextContent,
}));

const t = ((key: string) => key) as unknown as Parameters<typeof buildEmailSendToOptions>[0]["t"];

const makeSurvey = (overrides: Partial<TSurvey> = {}): TSurvey =>
  ({
    id: "survey1",
    blocks: [],
    hiddenFields: { enabled: true, fieldIds: [] },
    isVerifyEmailEnabled: false,
    ...overrides,
  }) as unknown as TSurvey;

describe("buildEmailSendToOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetElementsFromBlocks.mockReturnValue([]);
    // recallToHeadline returns a language-keyed map; the helper reads [selectedLanguageCode].
    mockRecallToHeadline.mockImplementation((headline) => headline);
    mockGetTextContent.mockImplementation((value: string) => value);
  });

  test("includes OpenText(email) and ContactInfo(email.show) elements, skipping others", () => {
    mockGetElementsFromBlocks.mockReturnValue([
      { id: "q1", type: TSurveyElementTypeEnum.OpenText, inputType: "email", headline: { default: "Email" } },
      { id: "q2", type: TSurveyElementTypeEnum.OpenText, inputType: "text", headline: { default: "Name" } },
      {
        id: "q3",
        type: TSurveyElementTypeEnum.ContactInfo,
        email: { show: true },
        headline: { default: "Contact" },
      },
      {
        id: "q4",
        type: TSurveyElementTypeEnum.ContactInfo,
        email: { show: false },
        headline: { default: "Contact hidden" },
      },
    ]);

    const options = buildEmailSendToOptions({
      survey: makeSurvey(),
      teamMemberDetails: [],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });

    const elementOptions = options.filter(
      (o) => o.type === "openTextElement" || o.type === "contactInfoElement"
    );
    expect(elementOptions).toEqual([
      { id: "q1", type: "openTextElement", label: "Email" },
      { id: "q3", type: "contactInfoElement", label: "Contact" },
    ]);
  });

  test("maps hidden fields to options labelled by id", () => {
    const options = buildEmailSendToOptions({
      survey: makeSurvey({ hiddenFields: { enabled: true, fieldIds: ["utm", "ref"] } }),
      teamMemberDetails: [],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });

    expect(options.filter((o) => o.type === "hiddenField")).toEqual([
      { id: "utm", type: "hiddenField", label: "utm" },
      { id: "ref", type: "hiddenField", label: "ref" },
    ]);
  });

  test("adds a verified-email option only when the survey enables it", () => {
    const withVerify = buildEmailSendToOptions({
      survey: makeSurvey({ isVerifyEmailEnabled: true }),
      teamMemberDetails: [],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });
    expect(withVerify.some((o) => o.type === "verifiedEmail" && o.id === "verifiedEmail")).toBe(true);

    const withoutVerify = buildEmailSendToOptions({
      survey: makeSurvey({ isVerifyEmailEnabled: false }),
      teamMemberDetails: [],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });
    expect(withoutVerify.some((o) => o.type === "verifiedEmail")).toBe(false);
  });

  test("surfaces team members and renames the current user to 'Yourself'", () => {
    const options = buildEmailSendToOptions({
      survey: makeSurvey(),
      teamMemberDetails: [
        { name: "Alice", email: "alice@example.com" },
        { name: "Me", email: "me@example.com" },
      ],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });

    const userOptions = options.filter((o) => o.type === "user");
    expect(userOptions).toEqual([
      { id: "alice@example.com", type: "user", label: "Alice (alice@example.com)" },
      { id: "me@example.com", type: "user", label: "Yourself (me@example.com)" },
    ]);
  });

  test("appends the current user as 'Yourself' when absent from the team roster", () => {
    const options = buildEmailSendToOptions({
      survey: makeSurvey(),
      teamMemberDetails: [{ name: "Alice", email: "alice@example.com" }],
      userEmail: "me@example.com",
      selectedLanguageCode: "default",
      t,
    });

    expect(options.filter((o) => o.type === "user")).toEqual([
      { id: "alice@example.com", type: "user", label: "Alice (alice@example.com)" },
      { id: "me@example.com", type: "user", label: "Yourself (me@example.com)" },
    ]);
  });
});

describe("findEmailSendToOption", () => {
  const options: EmailSendToOption[] = [
    { id: "verifiedEmail", type: "verifiedEmail", label: "Verified email" },
    { id: "aBc123", type: "openTextElement", label: "Your email" },
    { id: "userEmail", type: "hiddenField", label: "userEmail" },
    { id: "alice@example.com", type: "user", label: "Alice (alice@example.com)" },
  ];

  test("matches a member option regardless of case", () => {
    // The v3 API and MCP tools accept `to` verbatim, so a stored recipient can differ in case from
    // the member's address while the runtime allowlist (which normalizes both sides) still sends it.
    expect(findEmailSendToOption(options, "Alice@Example.com")?.id).toBe("alice@example.com");
  });

  test("leaves a padded address unmatched, matching how the runtime classifies it", () => {
    // `isLiteralEmailRecipient` (z.email()) rejects surrounding whitespace, so a padded `to` is never
    // a literal recipient: enable/test skip it entirely and every run then fails resolving it as an
    // element id. Trimming it into a member match here would hide a warning that is correct.
    expect(findEmailSendToOption(options, " alice@example.com")).toBeUndefined();
    expect(findEmailSendToOption(options, "alice@example.com ")).toBeUndefined();
  });

  test("prefers an exact non-user match over a case-insensitive member match", () => {
    // A hidden field can be named after a member's address. Options are built elements-then-members,
    // so the exact id wins and the response's own value keeps resolving.
    const collidingOptions: EmailSendToOption[] = [
      { id: "Alice@Example.com", type: "hiddenField", label: "Alice@Example.com" },
      { id: "alice@example.com", type: "user", label: "Alice (alice@example.com)" },
    ];

    expect(findEmailSendToOption(collidingOptions, "Alice@Example.com")?.type).toBe("hiddenField");
    expect(findEmailSendToOption(collidingOptions, "ALICE@EXAMPLE.COM")?.type).toBe("user");
  });

  test("matches element and hidden-field ids case-sensitively", () => {
    expect(findEmailSendToOption(options, "aBc123")?.type).toBe("openTextElement");
    expect(findEmailSendToOption(options, "abc123")).toBeUndefined();
    expect(findEmailSendToOption(options, "userEmail")?.type).toBe("hiddenField");
    expect(findEmailSendToOption(options, "useremail")).toBeUndefined();
    expect(findEmailSendToOption(options, "verifiedEmail")?.type).toBe("verifiedEmail");
  });

  test("returns undefined for an empty value or a recipient no option covers", () => {
    expect(findEmailSendToOption(options, "")).toBeUndefined();
    expect(findEmailSendToOption(options, "outsider@external.example")).toBeUndefined();
  });
});
