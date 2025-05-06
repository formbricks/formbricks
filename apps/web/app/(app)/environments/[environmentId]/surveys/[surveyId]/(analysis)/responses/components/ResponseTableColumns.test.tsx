import { processResponseData } from "@/lib/responses";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TResponseNote, TResponseNoteUser, TResponseTableData } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { generateResponseTableColumns } from "./ResponseTableColumns";

// Mock TFnType
const t = vi.fn((key: string, params?: any) => {
  if (params) {
    let message = key;
    for (const p in params) {
      message = message.replace(`{{${p}}}`, params[p]);
    }
    return message;
  }
  return key;
});

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((localizedString, locale) => localizedString[locale] || localizedString.default),
}));

vi.mock("@/lib/responses", () => ({
  processResponseData: vi.fn((data) => (Array.isArray(data) ? data.join(", ") : String(data))),
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: vi.fn((person) => person?.attributes?.email || person?.id || "Anonymous"),
}));

vi.mock("@/lib/utils/datetime", () => ({
  getFormattedDateTimeString: vi.fn((date) => new Date(date).toISOString()),
}));

vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: vi.fn((headline) => headline),
}));

vi.mock("@/modules/analysis/components/SingleResponseCard/components/RenderResponse", () => ({
  RenderResponse: vi.fn(({ responseData, isExpanded }) => (
    <div>
      RenderResponse: {JSON.stringify(responseData)} (Expanded: {String(isExpanded)})
    </div>
  )),
}));

vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionIconMap: vi.fn(() => ({
    [TSurveyQuestionTypeEnum.OpenText]: <span>OT</span>,
    [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: <span>MCS</span>,
    [TSurveyQuestionTypeEnum.Matrix]: <span>MX</span>,
    [TSurveyQuestionTypeEnum.Address]: <span>AD</span>,
    [TSurveyQuestionTypeEnum.ContactInfo]: <span>CI</span>,
  })),
  VARIABLES_ICON_MAP: {
    text: <span>VarT</span>,
    number: <span>VarN</span>,
  },
}));

vi.mock("@/modules/ui/components/data-table", () => ({
  getSelectionColumn: vi.fn(() => ({
    id: "select",
    header: "Select",
    cell: "SelectCell",
  })),
}));

vi.mock("@/modules/ui/components/response-badges", () => ({
  ResponseBadges: vi.fn(({ items, isExpanded }) => (
    <div>
      Badges: {items.join(", ")} (Expanded: {String(isExpanded)})
    </div>
  )),
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }) => <div>{children}</div>,
  TooltipContent: ({ children }) => <div>{children}</div>,
  TooltipProvider: ({ children }) => <div>{children}</div>,
  TooltipTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  CircleHelpIcon: () => <span>Help</span>,
  EyeOffIcon: () => <span>EyeOff</span>,
  MailIcon: () => <span>Mail</span>,
  TagIcon: () => <span>Tag</span>,
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1open",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Open Text Question" },
      required: true,
    } as unknown as TSurveyQuestion,
    {
      id: "q2matrix",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Matrix Question" },
      rows: [{ default: "Row1" }, { default: "Row2" }],
      columns: [{ default: "Col1" }, { default: "Col2" }],
      required: false,
    } as unknown as TSurveyQuestion,
    {
      id: "q3address",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Address Question" },
      required: false,
    } as unknown as TSurveyQuestion,
    {
      id: "q4contact",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Contact Info Question" },
      required: false,
    } as unknown as TSurveyQuestion,
  ],
  variables: [
    { id: "var1", name: "User Segment", type: "text" } as TSurveyVariable,
    { id: "var2", name: "Total Spend", type: "number" } as TSurveyVariable,
  ],
  hiddenFields: { enabled: true, fieldIds: ["hf1", "hf2"] },
  endings: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  isVerifyEmailEnabled: false,
  styling: null,
  languages: [],
  segment: null,
  projectOverwrites: null,
  singleUse: null,
  pin: null,
  resultShareKey: null,
  surveyClosedMessage: null,
  welcomeCard: {
    enabled: false,
  } as TSurvey["welcomeCard"],
} as unknown as TSurvey;

const mockResponseData = {
  contactAttributes: { country: "USA" },
  responseData: {
    q1open: "Open text answer",
    Row1: "Col1", // For matrix q2matrix
    Row2: "Col2",
    addressLine1: "123 Main St",
    city: "Anytown",
    firstName: "John",
    email: "john.doe@example.com",
    hf1: "Hidden Field 1 Value",
  },
  variables: {
    var1: "Segment A",
    var2: 100,
  },
  notes: [
    {
      id: "note1",
      text: "This is a note",
      updatedAt: new Date(),
      user: { name: "User" } as unknown as TResponseNoteUser,
    } as TResponseNote,
  ],
  status: "completed",
  tags: [{ id: "tag1", name: "Important" } as unknown as TTag],
  language: "default",
} as unknown as TResponseTableData;

describe("generateResponseTableColumns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    t.mockImplementation((key: string) => key); // Reset t mock for each test
  });

  afterEach(() => {
    cleanup();
  });

  test("should include selection column when not read-only", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, false, t as any);
    expect(columns[0].id).toBe("select");
    expect(vi.mocked(getSelectionColumn)).toHaveBeenCalledTimes(1);
  });

  test("should not include selection column when read-only", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    expect(columns[0].id).not.toBe("select");
    expect(vi.mocked(getSelectionColumn)).not.toHaveBeenCalled();
  });

  test("should include Verified Email column when survey.isVerifyEmailEnabled is true", () => {
    const surveyWithVerifiedEmail = { ...mockSurvey, isVerifyEmailEnabled: true };
    const columns = generateResponseTableColumns(surveyWithVerifiedEmail, false, true, t as any);
    expect(columns.some((col) => (col as any).accessorKey === "verifiedEmail")).toBe(true);
  });

  test("should not include Verified Email column when survey.isVerifyEmailEnabled is false", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    expect(columns.some((col) => (col as any).accessorKey === "verifiedEmail")).toBe(false);
  });

  test("should generate columns for variables", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const var1Col = columns.find((col) => (col as any).accessorKey === "var1");
    expect(var1Col).toBeDefined();
    const var1Cell = (var1Col?.cell as any)?.({ row: { original: mockResponseData } } as any);
    expect(var1Cell.props.children).toBe("Segment A");

    const var2Col = columns.find((col) => (col as any).accessorKey === "var2");
    expect(var2Col).toBeDefined();
    const var2Cell = (var2Col?.cell as any)?.({ row: { original: mockResponseData } } as any);
    expect(var2Cell.props.children).toBe(100);
  });

  test("should generate columns for hidden fields if fieldIds exist", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const hf1Col = columns.find((col) => (col as any).accessorKey === "hf1");
    expect(hf1Col).toBeDefined();
    const hf1Cell = (hf1Col?.cell as any)?.({ row: { original: mockResponseData } } as any);
    expect(hf1Cell.props.children).toBe("Hidden Field 1 Value");
  });

  test("should not generate columns for hidden fields if fieldIds is undefined", () => {
    const surveyWithoutHiddenFieldIds = { ...mockSurvey, hiddenFields: { enabled: true } };
    const columns = generateResponseTableColumns(surveyWithoutHiddenFieldIds, false, true, t as any);
    const hf1Col = columns.find((col) => (col as any).accessorKey === "hf1");
    expect(hf1Col).toBeUndefined();
  });

  test("should generate Notes column", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const notesCol = columns.find((col) => (col as any).accessorKey === "notes");
    expect(notesCol).toBeDefined();
    (notesCol?.cell as any)?.({ row: { original: mockResponseData } } as any);
    expect(vi.mocked(processResponseData)).toHaveBeenCalledWith(["This is a note"]);
  });
});
