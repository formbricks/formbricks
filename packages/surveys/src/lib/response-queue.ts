import { RECAPTCHA_VERIFICATION_ERROR_CODE } from "@/lib/constants";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";
import { TResponseUpdate } from "@formbricks/types/responses";
import { ApiClient } from "./api-client";
import { SurveyState } from "./survey-state";

interface QueueConfig {
  appUrl: string;
  environmentId: string;
  retryAttempts: number;
  onResponseSendingFailed?: (responseUpdate: TResponseUpdate, errorCode?: TResponseErrorCodesEnum) => void;
  onResponseSendingFinished?: () => void;
  setSurveyState?: (state: SurveyState) => void;
}

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class ResponseQueue {
  readonly queue: TResponseUpdate[] = [];
  readonly config: QueueConfig;
  private surveyState: SurveyState;
  private isRequestInProgress = false;
  readonly api: ApiClient;
  private responseRecaptchaToken?: string;

  constructor(config: QueueConfig, surveyState: SurveyState) {
    this.config = config;
    this.surveyState = surveyState;
    this.api = new ApiClient({
      appUrl: config.appUrl,
      environmentId: config.environmentId,
    });
  }

  setResponseRecaptchaToken(token?: string) {
    this.responseRecaptchaToken = token;
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
    if (this.isRequestInProgress || this.queue.length === 0) return;

    this.isRequestInProgress = true;

    const responseUpdate = this.queue[0];
    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      const res = await this.sendResponse(responseUpdate);

      if (res.ok) {
        this.queue.shift(); // remove the successfully sent response from the queue
        break; // exit the retry loop
      }

      if (res.error.details?.code === RECAPTCHA_VERIFICATION_ERROR_CODE) {
        this.isRequestInProgress = false;

        if (this.config.onResponseSendingFailed) {
          this.config.onResponseSendingFailed(responseUpdate, TResponseErrorCodesEnum.RecaptchaError);
        }
        return;
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
        this.config.onResponseSendingFailed(responseUpdate, TResponseErrorCodesEnum.ResponseSendingError);
      }
      this.isRequestInProgress = false;
    } else {
      if (responseUpdate.finished) {
        this.config.onResponseSendingFinished?.();
      }
      this.isRequestInProgress = false;
      this.processQueue(); // process the next item in the queue if any
    }
  }

  async sendResponse(responseUpdate: TResponseUpdate): Promise<Result<boolean, ApiErrorResponse>> {
    try {
      if (this.surveyState.responseId !== null) {
        await this.api.updateResponse({ ...responseUpdate, responseId: this.surveyState.responseId });
      } else {
        const response = await this.api.createResponse({
          ...responseUpdate,
          surveyId: this.surveyState.surveyId,
          contactId: this.surveyState.contactId || null,
          userId: this.surveyState.userId || null,
          singleUseId: this.surveyState.singleUseId || null,
          data: { ...responseUpdate.data, ...responseUpdate.hiddenFields },
          displayId: this.surveyState.displayId,
          recaptchaToken: this.responseRecaptchaToken ?? undefined,
        });

        if (!response.ok) {
          return err(response.error);
        }

        this.surveyState.updateResponseId(response.data.id);
        if (this.config.setSurveyState) {
          this.config.setSurveyState(this.surveyState);
        }
      }
      return ok(true);
    } catch (error) {
      console.error("Formbricks: Error sending response", error);
      return err({
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
      });
    }
  }

  // update surveyState
  updateSurveyState(surveyState: SurveyState) {
    this.surveyState = surveyState;
  }
}
