import { getSurveysBySegmentId } from "@/lib/survey/service";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SegmentTableDataRow } from "./segment-table-data-row";
import { SegmentTableDataRowContainer } from "./segment-table-data-row-container";

// Mock the child component
vi.mock("./segment-table-data-row", () => ({
  SegmentTableDataRow: vi.fn(() => <div>Mocked SegmentTableDataRow</div>),
}));

// Mock the service function
vi.mock("@/lib/survey/service", () => ({
  getSurveysBySegmentId: vi.fn(),
}));

const mockSegment: TSegment = {
  id: "seg1",
  title: "Segment 1",
  description: "Description 1",
  isPrivate: false,
  filters: [],
  environmentId: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveys: [],
};

const mockSegments: TSegment[] = [
  mockSegment,
  {
    id: "seg2",
    title: "Segment 2",
    description: "Description 2",
    isPrivate: false,
    filters: [],
    environmentId: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveys: [],
  },
];

const mockContactAttributeKeys: TContactAttributeKey[] = [
  { key: "email", label: "Email" } as unknown as TContactAttributeKey,
  { key: "userId", label: "User ID" } as unknown as TContactAttributeKey,
];

const mockSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Active Survey 1",
    status: "inProgress",
    type: "link",
    environmentId: "env1",
    questions: [],
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    segment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    variables: [],
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    styling: null,
    singleUse: null,
    pin: null,
    surveyClosedMessage: null,
    autoComplete: null,
    runOnDate: null,
    createdBy: null,
  } as unknown as TSurvey,
  {
    id: "survey2",
    name: "Inactive Survey 1",
    status: "draft",
    type: "link",
    environmentId: "env1",
    questions: [],
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    segment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    variables: [],
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    styling: null,
    singleUse: null,
    pin: null,
    surveyClosedMessage: null,
    autoComplete: null,
    runOnDate: null,
    createdBy: null,
  } as unknown as TSurvey,
  {
    id: "survey3",
    name: "Inactive Survey 2",
    status: "paused",
    type: "link",
    environmentId: "env1",
    questions: [],
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    segment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    variables: [],
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    styling: null,
    productOverwrites: null,
    singleUse: null,
    pin: null,
    surveyClosedMessage: null,
    autoComplete: null,
    runOnDate: null,
    createdBy: null,
  } as unknown as TSurvey,
];

describe("SegmentTableDataRowContainer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("fetches surveys, processes them, filters segments, and passes correct props", async () => {
    vi.mocked(getSurveysBySegmentId).mockResolvedValue(mockSurveys);

    const result = await SegmentTableDataRowContainer({
      currentSegment: mockSegment,
      segments: mockSegments,
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: true,
      isReadOnly: false,
    });

    expect(getSurveysBySegmentId).toHaveBeenCalledWith(mockSegment.id);

    expect(result.type).toBe(SegmentTableDataRow);
    expect(result.props).toEqual({
      currentSegment: {
        ...mockSegment,
        activeSurveys: ["Active Survey 1"],
        inactiveSurveys: ["Inactive Survey 1", "Inactive Survey 2"],
      },
      segments: mockSegments.filter((s) => s.id !== mockSegment.id),
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: true,
      isReadOnly: false,
    });
  });

  test("handles case with no surveys found", async () => {
    vi.mocked(getSurveysBySegmentId).mockResolvedValue([]);

    const result = await SegmentTableDataRowContainer({
      currentSegment: mockSegment,
      segments: mockSegments,
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: false,
      isReadOnly: true,
    });

    expect(getSurveysBySegmentId).toHaveBeenCalledWith(mockSegment.id);

    expect(result.type).toBe(SegmentTableDataRow);
    expect(result.props).toEqual({
      currentSegment: {
        ...mockSegment,
        activeSurveys: [],
        inactiveSurveys: [],
      },
      segments: mockSegments.filter((s) => s.id !== mockSegment.id),
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: false,
      isReadOnly: true,
    });
  });

  test("handles case where getSurveysBySegmentId returns null", async () => {
    vi.mocked(getSurveysBySegmentId).mockResolvedValue(null as any);

    const result = await SegmentTableDataRowContainer({
      currentSegment: mockSegment,
      segments: mockSegments,
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: true,
      isReadOnly: false,
    });

    expect(getSurveysBySegmentId).toHaveBeenCalledWith(mockSegment.id);

    expect(result.type).toBe(SegmentTableDataRow);
    expect(result.props).toEqual({
      currentSegment: {
        ...mockSegment,
        activeSurveys: [],
        inactiveSurveys: [],
      },
      segments: mockSegments.filter((s) => s.id !== mockSegment.id),
      contactAttributeKeys: mockContactAttributeKeys,
      isContactsEnabled: true,
      isReadOnly: false,
    });
  });
});
