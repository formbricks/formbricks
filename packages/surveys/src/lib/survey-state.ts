import { TResponseUpdate } from "@formbricks/types/responses";

export class SurveyState {
  responseId: string | null = null;
  displayId: string | null = null;
  userId: string | null = null;
  contactId: string | null = null;
  surveyId: string;
  shouldCreateResponseFromState = false;
  responseAcc: TResponseUpdate = { finished: false, data: {}, ttc: {}, variables: {} };
  singleUseId: string | null;

  constructor(
    surveyId: string,
    singleUseId?: string | null,
    responseId?: string | null,
    userId?: string | null,
    contactId?: string | null
  ) {
    this.surveyId = surveyId;
    this.userId = userId ?? null;
    this.singleUseId = singleUseId ?? null;
    this.responseId = responseId ?? null;
    this.contactId = contactId ?? null;
  }

  /**
   * Set the current survey ID
   * @param id - The survey ID
   */
  setSurveyId(id: string) {
    this.surveyId = id;
    this.clear(); // Reset the state when setting a new surveyId
  }
  /**
   * Get a copy of the current state
   */
  copy() {
    const copyInstance = new SurveyState(
      this.surveyId,
      this.singleUseId ?? undefined,
      this.responseId ?? undefined,
      this.userId ?? undefined,
      this.contactId ?? undefined
    );
    copyInstance.responseId = this.responseId;
    copyInstance.responseAcc = this.responseAcc;
    return copyInstance;
  }

  /**
   * Update the response ID after a successful response creation
   * @param id - The response ID
   */
  updateResponseId(id: string) {
    this.responseId = id;
  }

  /**
   * Update the display ID after a successful display creation
   * @param id - The display ID
   */
  updateDisplayId(id: string | null) {
    this.displayId = id;
  }

  /**
   * Update the user ID
   * @param id - The user ID
   */
  updateUserId(id: string) {
    this.userId = id;
  }

  /**
   * Update the contact ID
   * @param id - The contact ID
   */
  updateContactId(id: string) {
    this.contactId = id;
  }

  enableBootstrapResponseCreate() {
    this.shouldCreateResponseFromState = true;
  }

  disableBootstrapResponseCreate() {
    this.shouldCreateResponseFromState = false;
  }

  /**
   * Accumulate the responses
   * @param responseUpdate - The new response data to add
   */
  accumulateResponse(responseUpdate: TResponseUpdate) {
    this.responseAcc = {
      finished: responseUpdate.finished,
      ttc: { ...this.responseAcc.ttc, ...responseUpdate.ttc },
      data: { ...this.responseAcc.data, ...responseUpdate.data },
      variables: responseUpdate.variables ?? this.responseAcc.variables,
      displayId: responseUpdate.displayId ?? this.responseAcc.displayId,
      language: responseUpdate.language ?? this.responseAcc.language,
      meta: responseUpdate.meta ?? this.responseAcc.meta,
      hiddenFields: responseUpdate.hiddenFields ?? this.responseAcc.hiddenFields,
      endingId: responseUpdate.endingId,
    };
  }

  /**
   * Check if the current accumulated response is finished
   */
  isResponseFinished() {
    return this.responseAcc.finished;
  }

  /**
   * Clear the current state
   */
  clear() {
    this.responseId = null;
    this.shouldCreateResponseFromState = false;
    this.responseAcc = { finished: false, data: {}, ttc: {}, variables: {} };
  }
}
