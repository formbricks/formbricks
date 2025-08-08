import { extractChoiceIdsFromResponse } from "@/lib/response/utils";
import { processResponseData } from "@/lib/responses";
import { getContactIdentifier } from "@/lib/utils/contact";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
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
    [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: <span>MCM</span>,
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
  MousePointerClickIcon: () => <span>MousePointerClick</span>,
  AirplayIcon: () => <span>Airplay</span>,
  ArrowUpFromDotIcon: () => <span>ArrowUpFromDot</span>,
  FlagIcon: () => <span>Flag</span>,
  GlobeIcon: () => <span>Globe</span>,
  SmartphoneIcon: () => <span>Smartphone</span>,
}));

// Mock new dependencies
vi.mock("@/lib/response/utils", () => ({
  extractChoiceIdsFromResponse: vi.fn((responseValue) => {
    // Mock implementation that returns choice IDs based on response value
    if (Array.isArray(responseValue)) {
      return responseValue.map((_, index) => `choice-${index + 1}`);
    } else if (typeof responseValue === "string") {
      return [`choice-single`];
    }
    return [];
  }),
}));

vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: vi.fn(({ id }) => <div data-testid="id-badge">{id}</div>),
}));

vi.mock("@/modules/ui/lib/utils", () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(" ")),
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
    {
      id: "q5single",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Single Choice Question" },
      required: false,
      choices: [
        { id: "choice-1", label: { default: "Option 1" } },
        { id: "choice-2", label: { default: "Option 2" } },
        { id: "choice-3", label: { default: "Option 3" } },
      ],
    } as unknown as TSurveyQuestion,
    {
      id: "q6multi",
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      headline: { default: "Multi Choice Question" },
      required: false,
      choices: [
        { id: "choice-a", label: { default: "Choice A" } },
        { id: "choice-b", label: { default: "Choice B" } },
        { id: "choice-c", label: { default: "Choice C" } },
      ],
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
    q5single: "Option 1", // Single choice response
    q6multi: ["Choice A", "Choice C"], // Multi choice response
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

describe("ResponseTableColumns", () => {
  afterEach(() => {
    cleanup();
  });

  test("includes verifiedEmailColumn when isVerifyEmailEnabled is true", () => {
    // Arrange
    const mockSurvey = {
      questions: [],
      variables: [],
      hiddenFields: { fieldIds: [] },
      isVerifyEmailEnabled: true,
    } as unknown as TSurvey;

    const mockT = vi.fn((key) => key);
    const isExpanded = false;
    const isReadOnly = false;

    // Act
    const columns = generateResponseTableColumns(mockSurvey, isExpanded, isReadOnly, mockT);

    // Assert
    const verifiedEmailColumn: any = columns.find((col: any) => col.accessorKey === "verifiedEmail");
    expect(verifiedEmailColumn).toBeDefined();
    expect(verifiedEmailColumn?.accessorKey).toBe("verifiedEmail");

    // Call the header function to trigger the t function call with "common.verified_email"
    if (verifiedEmailColumn && typeof verifiedEmailColumn.header === "function") {
      verifiedEmailColumn.header();
      expect(mockT).toHaveBeenCalledWith("common.verified_email");
    }
  });

  test("excludes verifiedEmailColumn when isVerifyEmailEnabled is false", () => {
    // Arrange
    const mockSurvey = {
      questions: [],
      variables: [],
      hiddenFields: { fieldIds: [] },
      isVerifyEmailEnabled: false,
    } as unknown as TSurvey;

    const mockT = vi.fn((key) => key);
    const isExpanded = false;
    const isReadOnly = false;

    // Act
    const columns = generateResponseTableColumns(mockSurvey, isExpanded, isReadOnly, mockT);

    // Assert
    const verifiedEmailColumn = columns.find((col: any) => col.accessorKey === "verifiedEmail");
    expect(verifiedEmailColumn).toBeUndefined();
  });
});

describe("ResponseTableColumns - Column Implementations", () => {
  afterEach(() => {
    cleanup();
  });

  test("dateColumn renders with formatted date", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const dateColumn: any = columns.find((col) => (col as any).accessorKey === "createdAt");
    expect(dateColumn).toBeDefined();

    // Call the header function to test it returns the expected value
    expect(dateColumn?.header?.()).toBe("common.date");

    // Mock a response with a date to test the cell function
    const mockRow = {
      original: { createdAt: "2023-01-01T12:00:00Z" },
    } as any;

    // Call the cell function and check the formatted date
    dateColumn?.cell?.({ row: mockRow } as any);
    expect(vi.mocked(getFormattedDateTimeString)).toHaveBeenCalledWith(new Date("2023-01-01T12:00:00Z"));
  });

  test("personColumn renders anonymous when person is null", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const personColumn: any = columns.find((col) => (col as any).accessorKey === "personId");
    expect(personColumn).toBeDefined();

    // Test header content
    const headerResult = personColumn?.header?.();
    expect(headerResult).toBeDefined();

    // Mock a response with no person
    const mockRow = {
      original: { person: null },
    } as any;

    // Mock the t function for this specific call
    t.mockReturnValueOnce("Anonymous User");

    // Call the cell function and check it returns "Anonymous"
    const cellResult = personColumn?.cell?.({ row: mockRow } as any);
    expect(t).toHaveBeenCalledWith("common.anonymous");
    expect(cellResult?.props?.children).toBe("Anonymous User");
  });

  test("personColumn renders person identifier when person exists", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const personColumn: any = columns.find((col) => (col as any).accessorKey === "personId");
    expect(personColumn).toBeDefined();

    // Mock a response with a person
    const mockRow = {
      original: {
        person: { id: "123", attributes: { email: "test@example.com" } },
        contactAttributes: { name: "John Doe" },
      },
    } as any;

    // Call the cell function
    personColumn?.cell?.({ row: mockRow } as any);
    expect(vi.mocked(getContactIdentifier)).toHaveBeenCalledWith(
      mockRow.original.person,
      mockRow.original.contactAttributes
    );
  });

  test("tagsColumn returns undefined when tags is not an array", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const tagsColumn: any = columns.find((col) => (col as any).accessorKey === "tags");
    expect(tagsColumn).toBeDefined();

    // Mock a response with no tags
    const mockRow = {
      original: { tags: null },
    } as any;

    // Call the cell function
    const cellResult = tagsColumn?.cell?.({ row: mockRow } as any);
    expect(cellResult).toBeUndefined();
  });

  test("notesColumn renders when notes is an array", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const notesColumn: any = columns.find((col) => (col as any).accessorKey === "notes");
    expect(notesColumn).toBeDefined();

    // Mock a response with notes
    const mockRow = {
      original: { notes: [{ text: "Note 1" }, { text: "Note 2" }] },
    } as any;

    // Call the cell function
    notesColumn?.cell?.({ row: mockRow } as any);
    expect(vi.mocked(processResponseData)).toHaveBeenCalledWith(["Note 1", "Note 2"]);
  });

  test("notesColumn returns undefined when notes is not an array", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const notesColumn: any = columns.find((col) => (col as any).accessorKey === "notes");
    expect(notesColumn).toBeDefined();

    // Mock a response with no notes
    const mockRow = {
      original: { notes: null },
    } as any;

    // Call the cell function
    const cellResult = notesColumn?.cell?.({ row: mockRow } as any);
    expect(cellResult).toBeUndefined();
  });

  test("variableColumns render variable values correctly", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);

    // Find the variable column for var1
    const var1Column: any = columns.find((col) => (col as any).accessorKey === "var1");
    expect(var1Column).toBeDefined();

    // Test the header
    const headerResult = var1Column?.header?.();
    expect(headerResult).toBeDefined();

    // Mock a response with a string variable
    const mockRow = {
      original: { variables: { var1: "Test Value" } },
    } as any;

    // Call the cell function
    const cellResult = var1Column?.cell?.({ row: mockRow } as any);
    expect(cellResult?.props.children).toBe("Test Value");

    // Test with a number variable
    const var2Column: any = columns.find((col) => (col as any).accessorKey === "var2");
    expect(var2Column).toBeDefined();

    const mockRowNumber = {
      original: { variables: { var2: 42 } },
    } as any;

    const cellResultNumber = var2Column?.cell?.({ row: mockRowNumber } as any);
    expect(cellResultNumber?.props.children).toBe(42);
  });

  test("hiddenFieldColumns render when fieldIds exist", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);

    // Find the hidden field column
    const hfColumn: any = columns.find((col) => (col as any).accessorKey === "hf1");
    expect(hfColumn).toBeDefined();

    // Test the header
    const headerResult = hfColumn?.header?.();
    expect(headerResult).toBeDefined();

    // Mock a response with a hidden field value
    const mockRow = {
      original: { responseData: { hf1: "Hidden Value" } },
    } as any;

    // Call the cell function
    const cellResult = hfColumn?.cell?.({ row: mockRow } as any);
    expect(cellResult?.props.children).toBe("Hidden Value");
  });

  test("hiddenFieldColumns are empty when fieldIds don't exist", () => {
    // Create a survey with no hidden field IDs
    const surveyWithNoHiddenFields = {
      ...mockSurvey,
      hiddenFields: { enabled: true }, // no fieldIds
    };

    const columns = generateResponseTableColumns(surveyWithNoHiddenFields, false, true, t as any);

    // Check that no hidden field columns were created
    const hfColumn = columns.find((col) => (col as any).accessorKey === "hf1");
    expect(hfColumn).toBeUndefined();
  });
});

describe("ResponseTableColumns - Multiple Choice Questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("generates two columns for multipleChoiceSingle questions", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);

    // Should have main response column
    const mainColumn = columns.find((col) => (col as any).accessorKey === "q5single");
    expect(mainColumn).toBeDefined();

    // Should have option IDs column
    const optionIdsColumn = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");
    expect(optionIdsColumn).toBeDefined();
  });

  test("generates two columns for multipleChoiceMulti questions", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);

    // Should have main response column
    const mainColumn = columns.find((col) => (col as any).accessorKey === "q6multi");
    expect(mainColumn).toBeDefined();

    // Should have option IDs column
    const optionIdsColumn = columns.find((col) => (col as any).accessorKey === "q6multioptionIds");
    expect(optionIdsColumn).toBeDefined();
  });

  test("multipleChoiceSingle main column renders RenderResponse component", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const mainColumn: any = columns.find((col) => (col as any).accessorKey === "q5single");

    const mockRow = {
      original: {
        responseData: { q5single: "Option 1" },
        language: "default",
      },
    };

    const cellResult = mainColumn?.cell?.({ row: mockRow } as any);
    // Check that RenderResponse component is returned
    expect(cellResult).toBeDefined();
  });

  test("multipleChoiceMulti main column renders RenderResponse component", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const mainColumn: any = columns.find((col) => (col as any).accessorKey === "q6multi");

    const mockRow = {
      original: {
        responseData: { q6multi: ["Choice A", "Choice C"] },
        language: "default",
      },
    };

    const cellResult = mainColumn?.cell?.({ row: mockRow } as any);
    // Check that RenderResponse component is returned
    expect(cellResult).toBeDefined();
  });
});

describe("ResponseTableColumns - Choice ID Columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("option IDs column calls extractChoiceIdsFromResponse for string response", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");

    const mockRow = {
      original: {
        responseData: { q5single: "Option 1" },
        language: "default",
      },
    };

    optionIdsColumn?.cell?.({ row: mockRow } as any);

    expect(vi.mocked(extractChoiceIdsFromResponse)).toHaveBeenCalledWith(
      "Option 1",
      expect.objectContaining({ id: "q5single", type: "multipleChoiceSingle" }),
      "default"
    );
  });

  test("option IDs column calls extractChoiceIdsFromResponse for array response", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q6multioptionIds");

    const mockRow = {
      original: {
        responseData: { q6multi: ["Choice A", "Choice C"] },
        language: "default",
      },
    };

    optionIdsColumn?.cell?.({ row: mockRow } as any);

    expect(vi.mocked(extractChoiceIdsFromResponse)).toHaveBeenCalledWith(
      ["Choice A", "Choice C"],
      expect.objectContaining({ id: "q6multi", type: "multipleChoiceMulti" }),
      "default"
    );
  });

  test("option IDs column renders IdBadge components for choice IDs", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q6multioptionIds");

    const mockRow = {
      original: {
        responseData: { q6multi: ["Choice A", "Choice C"] },
        language: "default",
      },
    };

    // Mock extractChoiceIdsFromResponse to return specific choice IDs
    vi.mocked(extractChoiceIdsFromResponse).mockReturnValueOnce(["choice-1", "choice-3"]);

    const cellResult = optionIdsColumn?.cell?.({ row: mockRow } as any);

    // Should render something for choice IDs
    expect(cellResult).toBeDefined();
    // Verify that extractChoiceIdsFromResponse was called
    expect(vi.mocked(extractChoiceIdsFromResponse)).toHaveBeenCalled();
  });

  test("option IDs column returns null for non-string/array response values", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");

    const mockRow = {
      original: {
        responseData: { q5single: 123 }, // Invalid type
        language: "default",
      },
    };

    const cellResult = optionIdsColumn?.cell?.({ row: mockRow } as any);

    expect(cellResult).toBeNull();
    expect(vi.mocked(extractChoiceIdsFromResponse)).not.toHaveBeenCalled();
  });

  test("option IDs column returns null when no choice IDs found", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");

    const mockRow = {
      original: {
        responseData: { q5single: "Non-existent option" },
        language: "default",
      },
    };

    // Mock extractChoiceIdsFromResponse to return empty array
    vi.mocked(extractChoiceIdsFromResponse).mockReturnValueOnce([]);

    const cellResult = optionIdsColumn?.cell?.({ row: mockRow } as any);

    expect(cellResult).toBeNull();
  });

  test("option IDs column handles missing language gracefully", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");

    const mockRow = {
      original: {
        responseData: { q5single: "Option 1" },
        language: null, // No language
      },
    };

    optionIdsColumn?.cell?.({ row: mockRow } as any);

    expect(vi.mocked(extractChoiceIdsFromResponse)).toHaveBeenCalledWith(
      "Option 1",
      expect.objectContaining({ id: "q5single" }),
      undefined
    );
  });
});

describe("ResponseTableColumns - Helper Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("question headers are properly created for multiple choice questions", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const mainColumn: any = columns.find((col) => (col as any).accessorKey === "q5single");
    const optionIdsColumn: any = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");

    // Test main column header
    const mainHeader = mainColumn?.header?.();
    expect(mainHeader).toBeDefined();
    expect(mainHeader?.props?.className).toContain("flex items-center justify-between");

    // Test option IDs column header
    const optionHeader = optionIdsColumn?.header?.();
    expect(optionHeader).toBeDefined();
    expect(optionHeader?.props?.className).toContain("flex items-center justify-between");
  });

  test("question headers include proper icons for multiple choice questions", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);
    const singleChoiceColumn: any = columns.find((col) => (col as any).accessorKey === "q5single");
    const multiChoiceColumn: any = columns.find((col) => (col as any).accessorKey === "q6multi");

    // Headers should be functions that return JSX
    expect(typeof singleChoiceColumn?.header).toBe("function");
    expect(typeof multiChoiceColumn?.header).toBe("function");

    // Call headers to ensure they don't throw
    expect(() => singleChoiceColumn?.header?.()).not.toThrow();
    expect(() => multiChoiceColumn?.header?.()).not.toThrow();
  });
});

describe("ResponseTableColumns - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("multiple choice questions work end-to-end with real data", () => {
    const columns = generateResponseTableColumns(mockSurvey, false, true, t as any);

    // Find all multiple choice related columns
    const singleMainCol = columns.find((col) => (col as any).accessorKey === "q5single");
    const singleIdsCol = columns.find((col) => (col as any).accessorKey === "q5singleoptionIds");
    const multiMainCol = columns.find((col) => (col as any).accessorKey === "q6multi");
    const multiIdsCol = columns.find((col) => (col as any).accessorKey === "q6multioptionIds");

    expect(singleMainCol).toBeDefined();
    expect(singleIdsCol).toBeDefined();
    expect(multiMainCol).toBeDefined();
    expect(multiIdsCol).toBeDefined();

    // Test with actual mock response data
    const mockRow = { original: mockResponseData };

    // Test single choice main column
    const singleMainResult = (singleMainCol?.cell as any)?.({ row: mockRow });
    expect(singleMainResult).toBeDefined();

    // Test multi choice main column
    const multiMainResult = (multiMainCol?.cell as any)?.({ row: mockRow });
    expect(multiMainResult).toBeDefined();

    // Test that choice ID columns exist and can be called
    const singleIdsResult = (singleIdsCol?.cell as any)?.({ row: mockRow });
    const multiIdsResult = (multiIdsCol?.cell as any)?.({ row: mockRow });

    // Should not error when calling the cell functions
    expect(() => singleIdsResult).not.toThrow();
    expect(() => multiIdsResult).not.toThrow();
  });
});
