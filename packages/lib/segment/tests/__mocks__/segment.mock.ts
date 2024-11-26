import {
  TActionMetric,
  TBaseFilters,
  TBaseOperator,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TSegment,
  TSegmentCreateInput,
  TSegmentUpdateInput,
} from "@formbricks/types/segment";

export const mockSegmentId = "rh2eual2apby2bx0r027ru70";
export const mockDeleteSegmentId = "to336z1uth9cvyb1sh7k9i77";
export const mockEnvironmentId = "t7fszh4tsotoe87ppa6lqhie";
export const mockSurveyId = "phz5mjwvatwc0dqwuip90qpv";
export const mockFilterGroupId = "wi6zz4ekmcwi08bhv1hmgqcr";

export const mockFilerGroupResourceId1 = "j10rst27no5v68pjkop3p3f6";
export const mockFilterGroupResourceId11 = "qz97nzcz0phipgkkdgjlc2op";
export const mockFilterGroupResourceId2 = "wjy1rcs43knp0ef7b4jdsjri";
export const mockFilterGroupResourceId21 = "rjhll9q83qxc6fngl9byp0gn";

export const mockFilter2Id = "hp5ieqw889kt6k6z6wkuot8q";
export const mockFilter2Resource1Id = "iad253ddx4p7eshrbamsj4zk";

export const mockFilter3Id = "iix2savwqr4rv2y81ponep62";
export const mockFilter3Resource1Id = "evvoaniy0hn7srea7x0yn4vv";

// filter data:
export const mockActionClassId = "zg7lojfwnk9ipajgeumfz96t";
export const mockEmailValue = "example@example.com";
export const mockUserId = "random user id";
export const mockDeviceTypeValue = "phone";

// mock data for service input:
export const mockPersonId = "sb776r0uvt8m8puffe1hlhjn";
export const mockEvaluateSegmentUserAttributes: TEvaluateSegmentUserAttributeData = {
  email: mockEmailValue,
  userId: mockUserId,
};
export const mockEvaluateSegmentUserData: TEvaluateSegmentUserData = {
  personId: mockPersonId,
  environmentId: mockEnvironmentId,
  attributes: mockEvaluateSegmentUserAttributes,
  actionIds: [mockActionClassId],
  deviceType: "phone",
  userId: mockUserId,
};

export const mockSegmentTitle = "Engaged Users with Specific Interests";
export const mockSegmentDescription =
  "Segment targeting engaged users interested in specific topics and using mobile";

export const getMockSegmentFilters = (
  actionMetric: TActionMetric,
  actionValue: string | number,
  actionOperator: TBaseOperator
): TBaseFilters => [
  {
    id: mockFilterGroupId,
    connector: null,
    resource: [
      {
        id: mockFilerGroupResourceId1,
        connector: null,
        resource: {
          id: mockFilterGroupResourceId11,
          root: {
            type: "attribute",
            attributeClassName: "email",
          },
          value: mockEmailValue,
          qualifier: {
            operator: "equals",
          },
        },
      },
      {
        id: mockFilterGroupResourceId2,
        connector: "and",
        resource: {
          id: mockFilterGroupResourceId21,
          root: {
            type: "attribute",
            attributeClassName: "userId",
          },
          value: mockUserId,
          qualifier: {
            operator: "equals",
          },
        },
      },
    ],
  },
  {
    id: mockFilter2Id,
    connector: "and",
    resource: {
      id: mockFilter2Resource1Id,
      root: {
        type: "device",
        deviceType: "phone",
      },
      value: mockDeviceTypeValue,
      qualifier: {
        operator: "equals",
      },
    },
  },
  {
    id: mockFilter3Id,
    connector: "and",
    resource: {
      id: mockFilter3Resource1Id,
      root: {
        type: "action",
        actionClassId: mockActionClassId,
      },
      value: actionValue,
      qualifier: {
        metric: actionMetric,
        operator: actionOperator,
      },
    },
  },
];

export const mockSegment: TSegment = {
  id: mockSegmentId,
  title: mockSegmentTitle,
  description: mockSegmentDescription,
  isPrivate: false,
  filters: getMockSegmentFilters("lastMonthCount", 5, "equals"),
  environmentId: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveys: [mockSurveyId],
};

export const mockSegmentCreateInput: TSegmentCreateInput = {
  title: mockSegmentTitle,
  description: mockSegmentDescription,
  isPrivate: false,
  filters: getMockSegmentFilters("lastMonthCount", 5, "equals"),
  environmentId: mockEnvironmentId,
  surveyId: mockSurveyId,
};

export const mockSegmentUpdateInput: TSegmentUpdateInput = {
  title: mockSegmentTitle,
  description: mockSegmentDescription,
  isPrivate: false,
  filters: getMockSegmentFilters("lastMonthCount", 5, "greaterEqual"),
};

export const mockSegmentPrisma = {
  id: mockSegmentId,
  title: mockSegmentTitle,
  description: mockSegmentDescription,
  isPrivate: false,
  filters: getMockSegmentFilters("lastMonthCount", 5, "equals"),
  environmentId: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveys: [{ id: mockSurveyId }],
};

export const mockDeleteSegmentPrisma = {
  ...mockSegmentPrisma,
  id: mockDeleteSegmentId,
  surveys: [],
};

export const mockDeleteSegment = {
  ...mockSegment,
  id: mockDeleteSegmentId,
  surveys: [],
};

export const mockSegmentActiveInactiveSurves = {
  activeSurveys: ["Churn Survey"],
  inactiveSurveys: ["NPS Survey"],
};
