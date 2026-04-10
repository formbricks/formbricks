import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";
import { TQuotaFullResponse } from "@formbricks/types/quota";
import { TResponseUpdate } from "@formbricks/types/responses";
import { RECAPTCHA_VERIFICATION_ERROR_CODE } from "@/lib/constants";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { ApiClient } from "./api-client";
import {
  type SerializedSurveyState,
  addPendingResponse,
  countPendingResponses,
  getPendingResponses,
  removePendingResponse,
} from "./offline-storage";
import { SurveyState } from "./survey-state";

interface QueueConfig {
  appUrl: string;
  environmentId: string;
  retryAttempts: number;
  persistOffline?: boolean;
  surveyId?: string;
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
  // Maps in-memory queue index → IndexedDB id for cleanup after successful send
  private readonly pendingDbIds: Map<TResponseUpdate, number> = new Map();
  private isSyncing = false;

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

  private serializeSurveyState(): SerializedSurveyState {
    return {
      responseId: this.surveyState.responseId,
      displayId: this.surveyState.displayId,
      surveyId: this.surveyState.surveyId,
      singleUseId: this.surveyState.singleUseId,
      userId: this.surveyState.userId,
      contactId: this.surveyState.contactId,
      responseAcc: { ...this.surveyState.responseAcc },
    };
  }

  add(responseUpdate: TResponseUpdate) {
    // update survey state
    this.surveyState.accumulateResponse(responseUpdate);
    if (this.config.setSurveyState) {
      this.config.setSurveyState(this.surveyState);
    }
    // add response to queue
    this.queue.push(responseUpdate);

    // persist to IndexedDB if offline persistence is enabled,
    // then start processing only after the DB write completes
    if (this.config.persistOffline && this.config.surveyId) {
      void addPendingResponse({
        surveyId: this.config.surveyId,
        responseUpdate,
        surveyStateSnapshot: this.serializeSurveyState(),
        createdAt: Date.now(),
      }).then((dbId) => {
        if (dbId > 0) {
          this.pendingDbIds.set(responseUpdate, dbId);
        }
        this.processQueue();
      });
    } else {
      this.processQueue();
    }
  }

  async processQueue(): Promise<{ success: boolean }> {
    if (this.isRequestInProgress || this.queue.length === 0) {
      return { success: false };
    }

    // If offline and persistence is enabled, don't attempt to send — data is safe in IndexedDB.
    if (this.config.persistOffline && typeof navigator !== "undefined" && !navigator.onLine) {
      return { success: false };
    }

    // Don't send while syncPersistedResponses is draining IndexedDB — it handles everything.
    if (this.isSyncing) {
      return { success: false };
    }

    this.isRequestInProgress = true;
    const responseUpdate = this.queue[0];

    const result = await this.sendResponseWithRetry(responseUpdate);

    if (result.success) {
      // Remove from IndexedDB on successful send
      const dbId = this.pendingDbIds.get(responseUpdate);
      if (dbId !== undefined) {
        void removePendingResponse(dbId);
        this.pendingDbIds.delete(responseUpdate);
      }

      this.handleSuccessfulResponse(responseUpdate, result.quotaFullResponse);
      return { success: true };
    } else {
      // If offline persistence is enabled and we're now offline, don't treat it as a failure
      if (this.config.persistOffline && typeof navigator !== "undefined" && !navigator.onLine) {
        this.isRequestInProgress = false;
        return { success: false };
      }
      this.handleFailedResponse(responseUpdate, result.isRecaptchaError);
      return { success: false };
    }
  }

  /**
   * Returns the count of persisted pending responses without loading full data.
   * Does NOT populate the in-memory queue — syncPersistedResponses reads directly from IndexedDB.
   */
  async loadPersistedQueue(): Promise<number> {
    if (!this.config.persistOffline || !this.config.surveyId) return 0;
    return countPendingResponses(this.config.surveyId);
  }

  async getPendingCount(): Promise<number> {
    if (!this.config.persistOffline || !this.config.surveyId) return 0;
    return countPendingResponses(this.config.surveyId);
  }

  /**
   * Drains all persisted pending responses by sending them to the server in order.
   * Reads directly from IndexedDB to avoid object-identity issues with the in-memory queue.
   *
   * responseId propagation: If a snapshot has responseId=null, the first sendResponse call
   * will create a new response and set surveyState.responseId. Subsequent entries with
   * null responseId in their snapshot will correctly use the now-set responseId because
   * we only restore from snapshot when it has a non-null value.
   */
  async syncPersistedResponses(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ success: boolean; syncedCount: number }> {
    if (!this.config.persistOffline || !this.config.surveyId) {
      return { success: true, syncedCount: 0 };
    }

    // Concurrency guard: prevent duplicate syncs from online/offline flicker
    if (this.isSyncing) return { success: false, syncedCount: 0 };
    this.isSyncing = true;

    try {
      const entries = await getPendingResponses(this.config.surveyId);
      if (entries.length === 0) return { success: true, syncedCount: 0 };

      // Snapshot queue length before sync — entries added during async sync must be preserved.
      const queueLengthBeforeSync = this.queue.length;

      let syncedCount = 0;

      for (const entry of entries) {
        // Only restore responseId from snapshot when it was set at capture time.
        // Otherwise, let the responseId from the previous sendResponse carry forward
        // (i.e., a create response in the previous iteration sets the responseId for updates).
        if (entry.surveyStateSnapshot.responseId) {
          this.surveyState.updateResponseId(entry.surveyStateSnapshot.responseId);
        }

        let result = await this.sendResponse(entry.responseUpdate);

        // If updateResponse returned 404, the original createResponse likely never reached
        // the server. Reset responseId and retry as a fresh createResponse.
        if (!result.ok && result.error?.status === 404 && this.surveyState.responseId !== null) {
          this.surveyState.responseId = null;
          if (entry.surveyStateSnapshot.displayId) {
            this.surveyState.updateDisplayId(entry.surveyStateSnapshot.displayId);
          }
          result = await this.sendResponse(entry.responseUpdate);
        }

        if (entry.id !== undefined) {
          if (result.ok) {
            await removePendingResponse(entry.id);
          } else if (result.error && result.error.status >= 400 && result.error.status < 500) {
            // Client error (e.g., 409 "already completed") —
            // this entry is stale, remove it and continue with the next one.
            await removePendingResponse(entry.id);
            continue;
          } else {
            // Server/network error — stop syncing, remaining entries stay for next attempt
            return { success: false, syncedCount };
          }
        }

        syncedCount++;
        onProgress?.(syncedCount, entries.length);
      }

      // Only remove pre-sync entries from the in-memory queue.
      // Entries added by add() during the async sync loop must be preserved.
      const removed = this.queue.splice(0, queueLengthBeforeSync);
      for (const item of removed) {
        this.pendingDbIds.delete(item);
      }

      // Kick off processQueue for any entries added during sync
      if (this.queue.length > 0) {
        this.processQueue();
      }

      return { success: true, syncedCount };
    } finally {
      this.isSyncing = false;
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

        if (attempts > 0) {
          console.log(`Formbricks: Response sent successfully after ${attempts + 1} attempts`);
        }

        return { success: true, quotaFullResponse: quotaFullResponse ?? undefined };
      }

      if (this.isRecaptchaError(res.error)) {
        console.error("Formbricks: Recaptcha verification failed", {
          error: res.error,
          responseId: this.surveyState.responseId,
        });
        return { success: false, isRecaptchaError: true };
      }

      console.error(`Formbricks: Response send failed`, {
        attempt: attempts + 1,
        maxAttempts: this.config.retryAttempts,
        error: res.error,
        responseId: this.surveyState.responseId,
        queueLength: this.queue.length,
      });

      // Exponential backoff: 1s, 2s, 4s, 8s
      const backoffMs = 1000 * Math.pow(2, attempts);
      await delay(backoffMs);
      attempts++;
    }

    console.error(`Formbricks: Failed to send response after ${this.config.retryAttempts} attempts`, {
      queueLength: this.queue.length,
      responseId: this.surveyState.responseId,
      surveyId: this.surveyState.surveyId,
    });

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

  // get unsent response data from queue
  getUnsentData(): TResponseUpdate["data"] {
    return this.queue.reduce((acc, item) => ({ ...acc, ...item.data }), {});
  }
}
