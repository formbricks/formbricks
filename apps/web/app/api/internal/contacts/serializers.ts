/**
 * The outcome of saving a contact's attributes: what the save could not take as sent, or the keys it created,
 * as codes the edit dialog translates. Empty when everything was saved as sent.
 */
export type TContactAttributesResource = {
  contactId: string;
  messages: { code: string; params: Record<string, string> }[];
};

/** A personal link to a survey for one contact. */
export type TContactPersonalLinkResource = {
  surveyUrl: string;
};
