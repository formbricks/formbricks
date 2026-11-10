import type { TDisplayWithContact } from "@formbricks/types/displays";

/**
 * A display of the survey to a known contact, as the Summary page's Impressions tab lists it: when, and
 * the contact's id with its `email` and `userId` attributes. `createdAt` travels as an ISO string; the
 * page's API client revives it.
 */
export type TSurveyDisplayResource = Omit<TDisplayWithContact, "createdAt"> & { createdAt: string };

export const serializeSurveyDisplay = (display: TDisplayWithContact): TSurveyDisplayResource => ({
  id: display.id,
  createdAt: display.createdAt.toISOString(),
  surveyId: display.surveyId,
  contact: display.contact ? { id: display.contact.id, attributes: display.contact.attributes } : null,
});
