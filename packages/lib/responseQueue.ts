import { TResponseUpdate } from "@formbricks/types/v1/responses";
import { createResponse, updateResponse } from "./client/response";
import { updateDisplay } from "./client/display";
import SurveyState from "./surveyState";

interface QueueConfig {
  apiHost: string;
  retryAttempts: number;
  setSurveyState?: (state: SurveyState) => void;
  personId?: string;
}

export class ResponseQueue {
  private queue: TResponseUpdate[] = [];
  private config: QueueConfig;
  private surveyState: SurveyState;
  private isRequestInProgress = false;
  private i = 0;

  constructor(config: QueueConfig, surveyState: SurveyState) {
    this.config = config;
    this.surveyState = surveyState;
  }

  add(responseUpdate: TResponseUpdate) {
    // update survey state
    this.surveyState.accumulateResponse(responseUpdate);
    if (this.config.setSurveyState) {
      this.config.setSurveyState(this.surveyState);
    }
    // add response to queue
    this.queue.push(responseUpdate);
    this.processQueue();
  }

  async processQueue() {
    if (this.isRequestInProgress) return;
    if (this.queue.length === 0) return;

    this.isRequestInProgress = true;

    const responseUpdate = this.queue[0];
    const responseQuestionId = Object.keys(responseUpdate.data)[0];
    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      // const success = this.i === 1 ? false : await this.sendResponse(responseUpdate);
      const success = false;
      if (success) {
        this.surveyState.removeFailedResponse(responseQuestionId); // remove the response from the failed response list
        this.queue.shift(); // remove the successfully sent response from the queue
        break; // exit the retry loop
      }
      console.error("Formbricks: Failed to send response. Retrying...", attempts);
      attempts++;
    }

    if (attempts >= this.config.retryAttempts) {
      // Inform the user after 2 failed attempts
      console.error("Failed to send response after 2 attempts.");

      // Add the failed response to the failed response list
      this.surveyState.accumulateFailedResponses(responseQuestionId);

      this.queue.shift(); // remove the failed response from the queue
    }

    this.i++;
    this.isRequestInProgress = false;
    this.processQueue(); // process the next item in the queue if any
  }

  async sendResponse(responseUpdate: TResponseUpdate): Promise<boolean> {
    try {
      if (this.surveyState.responseId !== null) {
        await updateResponse(responseUpdate, this.surveyState.responseId, this.config.apiHost);
      } else {
        const response = await createResponse(
          {
            ...responseUpdate,
            surveyId: this.surveyState.surveyId,
            personId: this.config.personId || null,
            singleUseId: this.surveyState.singleUseId || null,
          },
          this.config.apiHost
        );
        if (this.surveyState.displayId) {
          await updateDisplay(this.surveyState.displayId, { responseId: response.id }, this.config.apiHost);
        }
        this.surveyState.updateResponseId(response.id);
        if (this.config.setSurveyState) {
          this.config.setSurveyState(this.surveyState);
        }
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // update surveyState
  updateSurveyState(surveyState: SurveyState) {
    this.surveyState = surveyState;
  }
}
