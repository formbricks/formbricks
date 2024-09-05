import { FormbricksAPI } from "@formbricks/api";
import { TResponseUpdate } from "@formbricks/types/responses";
import { SurveyState } from "./surveyState";
import { delay } from "./utils/promises";

interface QueueConfig {
  apiHost: string;
  environmentId: string;
  retryAttempts: number;
  onResponseSendingFailed?: (responseUpdate: TResponseUpdate) => void;
  onResponseSendingFinished?: () => void;
  setSurveyState?: (state: SurveyState) => void;
}

export class ResponseQueue {
  private queue: TResponseUpdate[] = [];
  private config: QueueConfig;
  private surveyState: SurveyState;
  private isRequestInProgress = false;
  private api: FormbricksAPI;

  constructor(config: QueueConfig, surveyState: SurveyState) {
    this.config = config;
    this.surveyState = surveyState;
    this.api = new FormbricksAPI({
      apiHost: config.apiHost,
      environmentId: config.environmentId,
    });
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
      console.error(`Formbricks: Failed to send response. Retrying... ${attempts}`);
      await delay(1000); // wait for 1 second before retrying
      attempts++;
    }

    if (attempts >= this.config.retryAttempts) {
      // Inform the user after 2 failed attempts
      console.error("Failed to send response after 2 attempts.");
      // If the response fails finally, inform the user
      if (this.config.onResponseSendingFailed) {
        this.config.onResponseSendingFailed(responseUpdate);
      }
      this.isRequestInProgress = false;
    } else {
      if (responseUpdate.finished && this.config.onResponseSendingFinished) {
        this.config.onResponseSendingFinished();
      }
      this.isRequestInProgress = false;
      this.processQueue(); // process the next item in the queue if any
    }
  }

  async sendResponse(responseUpdate: TResponseUpdate): Promise<boolean> {
    try {
      if (this.surveyState.responseId !== null) {
        await this.api.client.response.update({ ...responseUpdate, responseId: this.surveyState.responseId });
      } else {
        const response = await this.api.client.response.create({
          ...responseUpdate,
          surveyId: this.surveyState.surveyId,
          userId: this.surveyState.userId || null,
          singleUseId: this.surveyState.singleUseId || null,
          data: { ...responseUpdate.data, ...responseUpdate.hiddenFields },
          displayId: this.surveyState.displayId,
        });
        if (!response.ok) {
          throw new Error("Could not create response");
        }
        this.surveyState.updateResponseId(response.data.id);
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
