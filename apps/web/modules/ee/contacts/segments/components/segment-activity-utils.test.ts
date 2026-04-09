import { describe, expect, test } from "vitest";
import { TBaseFilters, TSegment, TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  buildSegmentActivitySummary,
  buildSegmentActivitySummaryFromSegments,
  doesSegmentReferenceSegment,
  getReferencingSegments,
} from "./segment-activity-utils";

const createSurvey = (overrides: Partial<TSurvey>): TSurvey =>
  ({
    id: "survey_1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Survey 1",
    type: "app",
    environmentId: "env_1",
    status: "inProgress",
    welcomeCard: {
      enabled: false,
      headline: {},
      html: {},
      fileUrl: "",
      buttonLabel: {},
      timeToFinish: false,
    },
    questions: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    endings: [],
    autoClose: null,
    displayOption: "displayOnce",
    displayPercentage: null,
    recontactDays: null,
    displayLimit: null,
    delay: 0,
    autoComplete: null,
    triggers: [],
    styling: null,
    surveyClosedMessage: null,
    segment: null,
    segmentId: null,
    projectOverwrites: null,
    singleUse: null,
    pin: null,
    redirectUrl: null,
    displayStatus: null,
    displayCount: null,
    languages: [],
    showLanguageSwitch: false,
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
    isBackButtonHidden: false,
    recaptcha: null,
    variables: [],
    blocks: undefined,
    followUps: [],
    verifyEmailTemplateId: null,
    ...overrides,
  }) as TSurvey;

const createSegment = (overrides: Partial<TSegment>): TSegment =>
  ({
    id: "segment_1",
    title: "Segment 1",
    description: null,
    isPrivate: false,
    environmentId: "env_1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveys: [],
    filters: [],
    ...overrides,
  }) as TSegment;

const createSegmentWithSurveyNames = (overrides: Partial<TSegmentWithSurveyRefs>): TSegmentWithSurveyRefs =>
  ({
    ...createSegment(overrides),
    activeSurveys: [],
    inactiveSurveys: [],
    ...overrides,
  }) as TSegmentWithSurveyRefs;

describe("segment activity utils", () => {
  test("doesSegmentReferenceSegment returns true for nested segment filters", () => {
    const filters: TBaseFilters = [
      {
        id: "group_1",
        connector: null,
        resource: [
          {
            id: "filter_1",
            connector: null,
            resource: {
              id: "segment_filter_1",
              root: {
                type: "segment",
                segmentId: "segment_target",
              },
              value: "segment_target",
              qualifier: {
                operator: "userIsNotIn",
              },
            },
          },
        ],
      },
    ];

    expect(doesSegmentReferenceSegment(filters, "segment_target")).toBe(true);
    expect(doesSegmentReferenceSegment(filters, "segment_other")).toBe(false);
  });

  test("getReferencingSegments excludes the current segment and returns only matching segments", () => {
    const segments = [
      createSegment({ id: "segment_target" }),
      createSegment({
        id: "segment_ref",
        filters: [
          {
            id: "filter_1",
            connector: null,
            resource: {
              id: "segment_filter_1",
              root: {
                type: "segment",
                segmentId: "segment_target",
              },
              value: "segment_target",
              qualifier: {
                operator: "userIsIn",
              },
            },
          },
        ],
      }),
      createSegment({
        id: "segment_other",
        filters: [
          {
            id: "filter_2",
            connector: null,
            resource: {
              id: "attribute_filter_1",
              root: {
                type: "attribute",
                contactAttributeKey: "plan",
              },
              value: "enterprise",
              qualifier: {
                operator: "equals",
              },
            },
          },
        ],
      }),
    ] as TSegmentWithSurveyRefs[];

    expect(getReferencingSegments(segments, "segment_target").map((segment) => segment.id)).toEqual([
      "segment_ref",
    ]);
  });

  test("buildSegmentActivitySummary returns direct surveys grouped by status", () => {
    const directSurveys = [
      createSurvey({
        id: "survey_direct",
        name: "Direct Survey",
        status: "inProgress",
      }),
      createSurvey({
        id: "survey_draft",
        name: "Draft Survey",
        status: "draft",
      }),
    ];

    expect(buildSegmentActivitySummary(directSurveys, [])).toEqual({
      activeSurveys: ["Direct Survey"],
      inactiveSurveys: ["Draft Survey"],
    });
  });

  test("buildSegmentActivitySummary includes indirect surveys when there is no direct match", () => {
    const indirectSurveyGroups = [
      {
        segmentId: "segment_ref",
        segmentTitle: "Referenced Segment",
        surveys: [
          createSurvey({
            id: "survey_draft",
            name: "Draft Survey",
            status: "draft",
          }),
        ],
      },
    ];

    expect(buildSegmentActivitySummary([], indirectSurveyGroups)).toEqual({
      activeSurveys: [],
      inactiveSurveys: ["Draft Survey"],
    });
  });

  test("buildSegmentActivitySummary prefers direct surveys over indirect duplicates", () => {
    const directSurveys = [
      createSurvey({
        id: "survey_shared",
        name: "Shared Survey",
        status: "inProgress",
      }),
    ];
    const indirectSurveyGroups = [
      {
        segmentId: "segment_ref",
        segmentTitle: "Referenced Segment",
        surveys: [
          createSurvey({
            id: "survey_shared",
            name: "Shared Survey",
            status: "inProgress",
          }),
        ],
      },
    ];

    expect(buildSegmentActivitySummary(directSurveys, indirectSurveyGroups)).toEqual({
      activeSurveys: ["Shared Survey"],
      inactiveSurveys: [],
    });
  });

  test("buildSegmentActivitySummary deduplicates indirect surveys referenced by multiple segments", () => {
    const indirectSurveyGroups = [
      {
        segmentId: "segment_ref_1",
        segmentTitle: "Referenced Segment 1",
        surveys: [
          createSurvey({
            id: "survey_indirect",
            name: "Indirect Survey",
            status: "paused",
          }),
        ],
      },
      {
        segmentId: "segment_ref_2",
        segmentTitle: "Referenced Segment 2",
        surveys: [
          createSurvey({
            id: "survey_indirect",
            name: "Indirect Survey",
            status: "paused",
          }),
        ],
      },
    ];

    expect(buildSegmentActivitySummary([], indirectSurveyGroups)).toEqual({
      activeSurveys: [],
      inactiveSurveys: ["Indirect Survey"],
    });
  });

  test("buildSegmentActivitySummaryFromSegments merges direct and indirect surveys from segment table data", () => {
    const currentSegment = createSegmentWithSurveyNames({
      id: "segment_target",
      activeSurveys: [{ id: "survey_direct", name: "Direct Survey" }],
      inactiveSurveys: [{ id: "survey_paused", name: "Paused Survey" }],
    });
    const segments = [
      currentSegment,
      createSegmentWithSurveyNames({
        id: "segment_ref",
        title: "Referenced Segment",
        activeSurveys: [{ id: "survey_indirect", name: "Indirect Survey" }],
        inactiveSurveys: [{ id: "survey_paused", name: "Paused Survey" }],
        filters: [
          {
            id: "filter_1",
            connector: null,
            resource: {
              id: "segment_filter_1",
              root: {
                type: "segment",
                segmentId: "segment_target",
              },
              value: "segment_target",
              qualifier: {
                operator: "userIsIn",
              },
            },
          },
        ],
      }),
    ];

    expect(buildSegmentActivitySummaryFromSegments(currentSegment, segments)).toEqual({
      activeSurveys: ["Direct Survey", "Indirect Survey"],
      inactiveSurveys: ["Paused Survey"],
    });
  });

  test("buildSegmentActivitySummaryFromSegments includes indirect usage from private survey segments", () => {
    const currentSegment = createSegmentWithSurveyNames({
      id: "segment_target",
    });

    const privateReferencingSegment = createSegmentWithSurveyNames({
      id: "segment_private_ref",
      title: "Private Survey Segment",
      isPrivate: true,
      activeSurveys: [{ id: "survey_private", name: "Indirect Private Survey" }],
      filters: [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "segment_filter_1",
            root: {
              type: "segment",
              segmentId: "segment_target",
            },
            value: "segment_target",
            qualifier: {
              operator: "userIsNotIn",
            },
          },
        },
      ],
    });

    expect(
      buildSegmentActivitySummaryFromSegments(currentSegment, [currentSegment, privateReferencingSegment])
    ).toEqual({
      activeSurveys: ["Indirect Private Survey"],
      inactiveSurveys: [],
    });
  });
});
