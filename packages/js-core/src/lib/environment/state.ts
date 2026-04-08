/* eslint-disable no-console -- logging required for error logging */
import { ApiClient } from "@/lib/common/api";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getIsDebug } from "@/lib/common/utils";
import type { TWorkspaceState } from "@/types/config";
import { type ApiErrorResponse, type Result, err, ok } from "@/types/error";

let workspaceStateSyncIntervalId: number | null = null;

/**
 * Fetch the workspace state from the backend
 * @param appUrl - The app URL
 * @param workspaceId - The workspace ID
 * @returns The workspace state
 * @throws NetworkError
 */
export const fetchWorkspaceState = async ({
  appUrl,
  workspaceId,
}: {
  appUrl: string;
  workspaceId: string;
}): Promise<Result<TWorkspaceState, ApiErrorResponse>> => {
  const url = `${appUrl}/api/v1/client/${workspaceId}/environment`;
  const api = new ApiClient({ appUrl, workspaceId, isDebug: getIsDebug() });

  try {
    const response = await api.getWorkspaceState();

    if (!response.ok) {
      return err({
        code: response.error.code,
        status: response.error.status,
        message: "Error syncing with backend",
        url: new URL(url),
        responseMessage: response.error.message,
      });
    }

    // The server responds with `data.workspace` but SDK internals use `data.settings`
    // to avoid `workspace.workspace` nesting. Map the field name here.
    const rawData = response.data as TWorkspaceState & {
      data: { workspace?: TWorkspaceState["data"]["settings"] };
    };

    if (rawData.data.workspace && !rawData.data.settings) {
      rawData.data.settings = rawData.data.workspace;
      delete rawData.data.workspace;
    }

    return ok(rawData);
  } catch (e: unknown) {
    const errorTyped = e as ApiErrorResponse;
    return err({
      code: "network_error",
      message: errorTyped.message,
      status: 500,
      url: new URL(url),
      responseMessage: errorTyped.responseMessage ?? "Network error",
    });
  }
};

/**
 * Add a listener to check if the workspace state has expired with a certain interval
 */
export const addWorkspaceStateExpiryCheckListener = (): void => {
  const appConfig = Config.getInstance();
  const logger = Logger.getInstance();

  const updateInterval = 1000 * 60; // every minute

  if (typeof window !== "undefined" && workspaceStateSyncIntervalId === null) {
    const intervalHandler = async (): Promise<void> => {
      const expiresAt = appConfig.get().workspaceState.expiresAt;

      try {
        // check if the environmentState has not expired yet
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- expiresAt is checked for null
        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Workspace state has expired. Starting sync.");

        const userState = appConfig.get().user;
        const workspaceState = await fetchWorkspaceState({
          appUrl: appConfig.get().appUrl,
          workspaceId: appConfig.get().workspaceId,
        });

        if (workspaceState.ok) {
          const { data: state } = workspaceState;
          const filteredSurveys = filterSurveys(state, userState);

          appConfig.update({
            ...appConfig.get(),
            workspaceState: state,
            filteredSurveys,
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- error is an ApiErrorResponse
          throw workspaceState.error;
        }
      } catch (e) {
        console.error(`Error during expiry check: `, e);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update({
          ...existingConfig,
          workspaceState: {
            ...existingConfig.workspaceState,
            expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
          },
        });
      }
    };

    workspaceStateSyncIntervalId = window.setInterval(
      () => void intervalHandler(),
      updateInterval
    ) as unknown as number;
  }
};

export const clearWorkspaceStateExpiryCheckListener = (): void => {
  if (workspaceStateSyncIntervalId) {
    clearInterval(workspaceStateSyncIntervalId);
    workspaceStateSyncIntervalId = null;
  }
};
