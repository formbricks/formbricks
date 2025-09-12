import { RECAPTCHA_VERIFICATION_ERROR_CODE } from "@/lib/constants";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";
import { TQuotaFullResponse } from "@formbricks/types/quota";
import { TResponseUpdate } from "@formbricks/types/responses";
import { ApiClient } from "./api-client";
import { SurveyState } from "./survey-state";

interface QueueConfig {
  appUrl: string;
  environmentId: string;
  retryAttempts: number;
  onResponseSendingFailed?: (responseUpdate: TResponseUpdate, errorCode?: TResponseErrorCodesEnum) => void;
  onResponseSendingFinished?: () => void;
  onQuotaFull?: (quotaInfo: TQuotaFullResponse) => void;
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

    const result = await this.sendResponseWithRetry(responseUpdate);

    if (result.success) {
      this.handleSuccessfulResponse(responseUpdate, result.quotaFullResponse);
    } else {
      this.handleFailedResponse(responseUpdate, result.isRecaptchaError);
    }
  }

  private async sendResponseWithRetry(responseUpdate: TResponseUpdate): Promise<{
    success: boolean;
    quotaFullResponse?: TQuotaFullResponse;
    isRecaptchaError?: boolean;
  }> {
    let attempts = 0;
    let quotaFullResponse: TQuotaFullResponse | null = null;

    while (attempts < this.config.retryAttempts) {
      const res = await this.sendResponse(responseUpdate);

      if (res.ok) {
        this.queue.shift(); // remove the successfully sent response from the queue

        if (this.isQuotaFullResponse(res.data)) {
          quotaFullResponse = res.data;
        }

        return { success: true, quotaFullResponse: quotaFullResponse ?? undefined };
      }

      if (this.isRecaptchaError(res.error)) {
        return { success: false, isRecaptchaError: true };
      }

      console.error(`Formbricks: Failed to send response. Retrying... ${attempts}`);
      await delay(1000);
      attempts++;
    }

    return { success: false, isRecaptchaError: false };
  }

  private isQuotaFullResponse(data: unknown): data is TQuotaFullResponse {
    return typeof data === "object" && data !== null && "quotaFull" in data;
  }

  private isRecaptchaError(error: any): boolean {
    return error.details?.code === RECAPTCHA_VERIFICATION_ERROR_CODE;
  }

  private handleSuccessfulResponse(responseUpdate: TResponseUpdate, quotaFullResponse?: TQuotaFullResponse) {
    if (responseUpdate.finished) {
      this.config.onResponseSendingFinished?.();
    }

    this.isRequestInProgress = false;

    if (quotaFullResponse) {
      this.config.onQuotaFull?.(quotaFullResponse);
    }

    this.processQueue(); // process the next item in the queue if any
  }

  private handleFailedResponse(responseUpdate: TResponseUpdate, isRecaptchaError?: boolean) {
    this.isRequestInProgress = false;

    if (isRecaptchaError) {
      this.config.onResponseSendingFailed?.(responseUpdate, TResponseErrorCodesEnum.RecaptchaError);
      return;
    }

    console.error(`Failed to send response after ${this.config.retryAttempts} attempts.`);
    this.config.onResponseSendingFailed?.(responseUpdate, TResponseErrorCodesEnum.ResponseSendingError);
  }

  async sendResponse(
    responseUpdate: TResponseUpdate
  ): Promise<Result<boolean | TQuotaFullResponse, ApiErrorResponse>> {
    try {
      let response;
      if (this.surveyState.responseId !== null) {
        response = await this.api.updateResponse({
          ...responseUpdate,
          responseId: this.surveyState.responseId,
        });

        if (!response.ok) {
          return err(response.error);
        }
      } else {
        response = await this.api.createResponse({
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

      // Check for quota-full response
      if (response.ok && response.data.quotaFull) {
        return ok({
          quotaFull: true,
          quotaId: response.data.quota.id,
          action: response.data.quota.action,
          endingCardId: response.data.quota.endingCardId || "",
        });
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
