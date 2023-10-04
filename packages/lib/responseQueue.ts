import { TResponseUpdate } from "@formbricks/types/v1/responses";
import { createResponse, updateResponse } from "./client/response";
import SurveyState from "./surveyState";
import { markDisplayResponded } from "./client/display";

interface QueueConfig {
  apiHost: string;
  retryAttempts: number;
  onResponseSendingFailed?: (responseUpdate: TResponseUpdate) => void;
  setSurveyState?: (state: SurveyState) => void;
  personId?: string;
}

export class ResponseQueue {
  private queue: TResponseUpdate[] = [];
  private config: QueueConfig;
  private surveyState: SurveyState;
  private isRequestInProgress = false;

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
    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      const success = await this.sendResponse(responseUpdate);
      if (success) {
        this.queue.shift(); // remove the successfully sent response from the queue
        break; // exit the retry loop
      }
      console.error("Formbricks: Failed to send response. Retrying...", attempts);
      attempts++;
    }

    if (attempts >= this.config.retryAttempts) {
      // Inform the user after 2 failed attempts
      console.error("Failed to send response after 2 attempts.");
      // If the response is finished and thus fails finally, inform the user
      if (this.surveyState.responseAcc.finished && this.config.onResponseSendingFailed) {
        this.config.onResponseSendingFailed(this.surveyState.responseAcc);
      }
      this.queue.shift(); // remove the failed response from the queue
    }

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
          markDisplayResponded(this.surveyState.displayId, this.config.apiHost);
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
