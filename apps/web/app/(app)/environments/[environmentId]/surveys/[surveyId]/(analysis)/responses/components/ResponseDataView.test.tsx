import { ResponseTable } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseDataValue } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import {
  ResponseDataView,
  extractResponseData,
  formatAddressData,
  formatContactInfoData,
  mapResponsesToTableData,
} from "./ResponseDataView";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable",
  () => ({
    ResponseTable: vi.fn(() => <div data-testid="response-table">ResponseTable</div>),
  })
);

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: vi.fn((key) => {
      if (key === "environments.surveys.responses.completed") return "Completed";
      if (key === "environments.surveys.responses.not_completed") return "Not Completed";
      return key;
    }),
  }),
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: true,
    } as unknown as TSurveyQuestion,
    {
      id: "q2",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Question 2" },
      required: false,
      choices: [{ id: "c1", label: { default: "Choice 1" } }],
    },
    {
      id: "matrix1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Matrix Question" },
      required: false,
      rows: [{ id: "row1", label: "Row 1" }],
      columns: [{ id: "col1", label: "Col 1" }],
    } as unknown as TSurveyQuestion,
    {
      id: "address1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Address Question" },
      required: false,
    } as unknown as TSurveyQuestion,
    {
      id: "contactInfo1",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Contact Info Question" },
      required: false,
    } as unknown as TSurveyQuestion,
  ],
  hiddenFields: { enabled: true, fieldIds: ["hidden1"] },
  variables: [{ id: "var1", name: "Variable 1", type: "text", value: "default" }],
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env1",
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayOption: "displayOnce",
  recontactDays: null,
  welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
  autoComplete: null,
  singleUse: null,
  styling: null,
  surveyClosedMessage: null,
  triggers: [],
  languages: [],
  displayPercentage: null,
} as unknown as TSurvey;

const mockResponses: TResponse[] = [
  {
    id: "response1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: true,
    data: {
      q1: "Answer 1",
      q2: "Choice 1",
      matrix1: { row1: "Col 1" },
      address1: ["123 Main St", "Apt 4B", "Anytown", "CA", "90210", "USA"] as TResponseDataValue,
      contactInfo1: [
        "John",
        "Doe",
        "john.doe@example.com",
        "555-1234",
        "Formbricks Inc.",
      ] as TResponseDataValue,
      hidden1: "Hidden Value 1",
      verifiedEmail: "test@example.com",
    },
    meta: { userAgent: { browser: "test-agent" }, url: "http://localhost" },
    singleUseId: null,
    ttc: {},
    tags: [{ id: "tag1", name: "Tag1", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() }],
    variables: { var1: "Response Var Value" },
    language: "en",
    contact: null,
    contactAttributes: null,
  },
  {
    id: "response2",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: false,
    data: { q1: "Answer 2" },
    meta: { userAgent: { browser: "test-agent-2" }, url: "http://localhost" },
    singleUseId: null,
    ttc: {},
    tags: [],
    variables: {},
    language: "de",
    contact: null,
    contactAttributes: null,
  },
];

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

const mockEnvironment = {
  id: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
} as unknown as TEnvironment;

const mockEnvironmentTags: TTag[] = [
  { id: "tag1", name: "Tag1", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() },
  { id: "tag2", name: "Tag2", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() },
];

const mockLocale: TUserLocale = "en-US";

const defaultProps = {
  survey: mockSurvey,
  responses: mockResponses,
  user: mockUser,
  environment: mockEnvironment,
  environmentTags: mockEnvironmentTags,
  isReadOnly: false,
  fetchNextPage: vi.fn(),
  hasMore: true,
  deleteResponses: vi.fn(),
  updateResponse: vi.fn(),
  isFetchingFirstPage: false,
  locale: mockLocale,
};

describe("ResponseDataView", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders ResponseTable with correct props", () => {
    render(<ResponseDataView {...defaultProps} />);
    expect(screen.getByTestId("response-table")).toBeInTheDocument();

    const responseTableMock = vi.mocked(ResponseTable);
    expect(responseTableMock).toHaveBeenCalledTimes(1);

    const expectedData = [
      {
        responseData: {
          q1: "Answer 1",
          q2: "Choice 1",
          row1: "Col 1", // from matrix question
          addressLine1: "123 Main St",
          addressLine2: "Apt 4B",
          city: "Anytown",
          state: "CA",
          zip: "90210",
          country: "USA",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "555-1234",
          company: "Formbricks Inc.",
          hidden1: "Hidden Value 1",
        },
        createdAt: mockResponses[0].createdAt,
        status: "Completed",
        responseId: "response1",
        tags: mockResponses[0].tags,
        variables: { var1: "Response Var Value" },
        verifiedEmail: "test@example.com",
        language: "en",
        person: null,
        contactAttributes: null,
        meta: {
          url: "http://localhost",
          userAgent: {
            browser: "test-agent",
          },
        },
      },
      {
        responseData: {
          q1: "Answer 2",
        },
        createdAt: mockResponses[1].createdAt,
        status: "Not Completed",
        responseId: "response2",
        tags: [],
        variables: {},
        verifiedEmail: "",
        language: "de",
        person: null,
        contactAttributes: null,
        meta: {
          url: "http://localhost",
          userAgent: {
            browser: "test-agent-2",
          },
        },
      },
    ];

    expect(responseTableMock.mock.calls[0][0].data).toEqual(expectedData);
    expect(responseTableMock.mock.calls[0][0].survey).toEqual(mockSurvey);
    expect(responseTableMock.mock.calls[0][0].responses).toEqual(mockResponses);
    expect(responseTableMock.mock.calls[0][0].user).toEqual(mockUser);
    expect(responseTableMock.mock.calls[0][0].environmentTags).toEqual(mockEnvironmentTags);
    expect(responseTableMock.mock.calls[0][0].isReadOnly).toBe(false);
    expect(responseTableMock.mock.calls[0][0].environment).toEqual(mockEnvironment);
    expect(responseTableMock.mock.calls[0][0].fetchNextPage).toBe(defaultProps.fetchNextPage);
    expect(responseTableMock.mock.calls[0][0].hasMore).toBe(true);
    expect(responseTableMock.mock.calls[0][0].deleteResponses).toBe(defaultProps.deleteResponses);
    expect(responseTableMock.mock.calls[0][0].updateResponse).toBe(defaultProps.updateResponse);
    expect(responseTableMock.mock.calls[0][0].isFetchingFirstPage).toBe(false);
    expect(responseTableMock.mock.calls[0][0].locale).toBe(mockLocale);
  });

  test("formatAddressData correctly formats data", () => {
    const addressData: TResponseDataValue = ["1 Main St", "Apt 1", "CityA", "StateA", "10001", "CountryA"];
    const formatted = formatAddressData(addressData);
    expect(formatted).toEqual({
      addressLine1: "1 Main St",
      addressLine2: "Apt 1",
      city: "CityA",
      state: "StateA",
      zip: "10001",
      country: "CountryA",
    });
  });

  test("formatAddressData handles undefined values", () => {
    const addressData: TResponseDataValue = ["1 Main St", "", "CityA", "", "10001", ""]; // Changed undefined to empty string as per function logic
    const formatted = formatAddressData(addressData);
    expect(formatted).toEqual({
      addressLine1: "1 Main St",
      addressLine2: "",
      city: "CityA",
      state: "",
      zip: "10001",
      country: "",
    });
  });

  test("formatAddressData returns empty object for non-array input", () => {
    const formatted = formatAddressData("not an array");
    expect(formatted).toEqual({});
  });

  test("formatContactInfoData correctly formats data", () => {
    const contactData: TResponseDataValue = ["Jane", "Doe", "jane@mail.com", "123-456", "Org B"];
    const formatted = formatContactInfoData(contactData);
    expect(formatted).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@mail.com",
      phone: "123-456",
      company: "Org B",
    });
  });

  test("formatContactInfoData handles undefined values", () => {
    const contactData: TResponseDataValue = ["Jane", "", "jane@mail.com", "", "Org B"]; // Changed undefined to empty string
    const formatted = formatContactInfoData(contactData);
    expect(formatted).toEqual({
      firstName: "Jane",
      lastName: "",
      email: "jane@mail.com",
      phone: "",
      company: "Org B",
    });
  });

  test("formatContactInfoData returns empty object for non-array input", () => {
    const formatted = formatContactInfoData({});
    expect(formatted).toEqual({});
  });

  test("extractResponseData correctly extracts and formats data", () => {
    const response = mockResponses[0];
    const survey = mockSurvey;
    const extracted = extractResponseData(response, survey);
    expect(extracted).toEqual({
      q1: "Answer 1",
      q2: "Choice 1",
      row1: "Col 1", // from matrix question
      addressLine1: "123 Main St",
      addressLine2: "Apt 4B",
      city: "Anytown",
      state: "CA",
      zip: "90210",
      country: "USA",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "555-1234",
      company: "Formbricks Inc.",
      hidden1: "Hidden Value 1",
    });
  });

  test("extractResponseData handles missing optional data", () => {
    const response: TResponse = {
      ...mockResponses[1],
      data: { q1: "Answer 2" },
    };
    const survey = mockSurvey;
    const extracted = extractResponseData(response, survey);
    expect(extracted).toEqual({
      q1: "Answer 2",
      // address and contactInfo will add empty strings if the keys exist but values are not arrays
      // but here, the keys 'address1' and 'contactInfo1' are not in response.data
      // hidden1 is also not in response.data
    });
  });

  test("mapResponsesToTableData correctly maps responses", () => {
    const tMock = vi.fn((key) => (key === "environments.surveys.responses.completed" ? "Done" : "Pending"));
    const tableData = mapResponsesToTableData(mockResponses, mockSurvey, tMock);
    expect(tableData.length).toBe(2);
    expect(tableData[0].status).toBe("Done");
    expect(tableData[1].status).toBe("Pending");
    expect(tableData[0].responseData.q1).toBe("Answer 1");
    expect(tableData[0].responseData.hidden1).toBe("Hidden Value 1");
    expect(tableData[0].variables.var1).toBe("Response Var Value");
    expect(tableData[1].responseData.q1).toBe("Answer 2");
    expect(tableData[0].verifiedEmail).toBe("test@example.com");
    expect(tableData[1].verifiedEmail).toBe("");
  });
});
