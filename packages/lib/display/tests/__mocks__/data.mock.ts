import {
  TDisplay,
  TDisplayCreateInput,
  TDisplayLegacyCreateInput,
  TDisplayLegacyUpdateInput,
  TDisplayUpdateInput,
} from "@formbricks/types/displays";

export const mockEnvironmentId = "clqkr5961000108jyfnjmbjhi";
export const mockSingleUseId = "qj57j3opsw8b5sxgea20fgcq";
export const mockSurveyId = "clqkr8dlv000308jybb08evgr";
export const mockUserId = "qwywazmugeezyfr3zcg9jk8a";
export const mockDisplayId = "clqkr5smu000208jy50v6g5k4";
export const mockId = "ars2tjk8hsi8oqk1uac00mo8";
export const mockPersonId = "clqnj99r9000008lebgf8734j";
export const mockResponseId = "clqnfg59i000208i426pb4wcv";

function createMockDisplay(overrides = {}) {
  return {
    id: mockDisplayId,
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: mockSurveyId,
    responseId: null,
    personId: null,
    status: null,
    ...overrides,
  };
}

export const mockDisplay: TDisplay = createMockDisplay();

export const mockDisplayWithPersonId: TDisplay = createMockDisplay({ personId: mockPersonId });

export const mockDisplayWithResponseId: TDisplay = createMockDisplay({
  personId: mockPersonId,
  responseId: mockResponseId,
});

export const mockDisplayInput: TDisplayCreateInput = {
  environmentId: mockEnvironmentId,
  surveyId: mockSurveyId,
};
export const mockDisplayInputWithUserId: TDisplayCreateInput = {
  ...mockDisplayInput,
  userId: mockUserId,
};
export const mockDisplayInputWithResponseId: TDisplayCreateInput = {
  ...mockDisplayInputWithUserId,
  responseId: mockResponseId,
};

export const mockDisplayLegacyInput: TDisplayLegacyCreateInput = {
  responseId: mockResponseId,
  surveyId: mockSurveyId,
};
export const mockDisplayLegacyInputWithPersonId: TDisplayLegacyCreateInput = {
  ...mockDisplayLegacyInput,
  personId: mockPersonId,
};

export const mockDisplayUpdate: TDisplayUpdateInput = {
  environmentId: mockEnvironmentId,
  userId: mockUserId,
  responseId: mockResponseId,
};

export const mockDisplayLegacyUpdateInput: TDisplayLegacyUpdateInput = {
  personId: mockPersonId,
  responseId: mockResponseId,
};

export const mockDisplayLegacyWithRespondedStatus: TDisplay = {
  ...mockDisplayWithPersonId,
  status: "responded",
};
