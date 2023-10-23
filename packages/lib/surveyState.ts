import { TResponseUpdate } from "@formbricks/types/responses";

export class SurveyState {
  responseId: string | null = null;
  displayId: string | null = null;
  surveyId: string;
  responseAcc: TResponseUpdate = { finished: false, data: {} };
  failedResponses: Record<string, boolean> = {};
  singleUseId: string | null;

  constructor(surveyId: string, singleUseId?: string, responseId?: string) {
    this.surveyId = surveyId;
    this.singleUseId = singleUseId ?? null;
    this.responseId = responseId ?? null;
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
      this.responseId ?? undefined
    );
    copyInstance.responseId = this.responseId;
    copyInstance.responseAcc = this.responseAcc;
    copyInstance.failedResponses = this.failedResponses;
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
   * Update the response ID after a successful response creation
   * @param id - The response ID
   */
  updateDisplayId(id: string) {
    this.displayId = id;
  }

  /**
   * Accumulate the responses
   * @param responseUpdate - The new response data to add
   */
  accumulateResponse(responseUpdate: TResponseUpdate) {
    this.responseAcc = {
      finished: responseUpdate.finished,
      data: { ...this.responseAcc.data, ...responseUpdate.data },
    };
  }

  /**
   * Check if the current accumulated response is finished
   */
  isResponseFinished() {
    return this.responseAcc.finished;
  }

  /**
   * Adds questionId to the failed response accumulator object
   */
  accumulateFailedResponses(questionId: string) {
    this.failedResponses[questionId] = true;
  }
  /**
   * Remove a questionId from the failed response accumulator object
   */
  removeFailedResponse(questionId: string) {
    delete this.failedResponses[questionId];
  }

  /**
   * Check if there are any failed responses
   */
  hasFailedResponses() {
    return Object.keys(this.failedResponses).length > 0;
  }

  /**
   * Get the Response Accumulator
   */
  getResponseAccumulator() {
    return this.responseAcc;
  }

  /**
   * Clear the current state
   */
  clear() {
    this.responseId = null;
    this.responseAcc = { finished: false, data: {} };
    this.failedResponses = {};
  }
}

export default SurveyState;
