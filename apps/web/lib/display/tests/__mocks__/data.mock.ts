import type { Display } from "@formbricks/database/prisma";

export const mockSurveyId = "clqkr8dlv000308jybb08evgr";
export const mockUserId = "qwywazmugeezyfr3zcg9jk8a";
export const mockDisplayId = "clqkr5smu000208jy50v6g5k4";
export const mockId = "ars2tjk8hsi8oqk1uac00mo8";
export const mockContactId = "clqnj99r9000008lebgf8734j";
export const mockResponseId = "clqnfg59i000208i426pb4wcv";

// A display row as the Prisma model has it: the response links back through Response.displayId.
const createMockDisplay = (overrides: Partial<Display> = {}): Display => ({
  id: mockDisplayId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: mockSurveyId,
  contactId: null,
  creativeId: null,
  ...overrides,
});

export const mockDisplay = createMockDisplay();

export const mockDisplayWithContactId = createMockDisplay({ contactId: mockContactId });

export const mockDisplayInput = {
  workspaceId: mockId,
  surveyId: mockSurveyId,
};
export const mockDisplayInputWithUserId = {
  ...mockDisplayInput,
  userId: mockUserId,
};
export const mockDisplayInputWithResponseId = {
  ...mockDisplayInputWithUserId,
  responseId: mockResponseId,
};

export const mockDisplayUpdate = {
  userId: mockUserId,
  responseId: mockResponseId,
};
