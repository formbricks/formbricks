import { ApiClient } from "@/lib/common/api";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getIsDebug } from "@/lib/common/utils";
import type { TWorkspaceState } from "@/types/config";
import { type ApiErrorResponse, type Result, err, ok } from "@/types/error";

let workspaceSyncIntervalId: number | null = null;

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

  if (typeof window !== "undefined" && workspaceSyncIntervalId === null) {
    const intervalHandler = async (): Promise<void> => {
      const expiresAt = appConfig.get().workspace.expiresAt;

      try {
        // check if the environmentState has not expired yet

        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Workspace state has expired. Starting sync.");

        const userState = appConfig.get().user;
        const workspace = await fetchWorkspaceState({
          appUrl: appConfig.get().appUrl,
          workspaceId: appConfig.get().workspaceId,
        });

        if (workspace.ok) {
          const { data: state } = workspace;
          const filteredSurveys = filterSurveys(state, userState);

          appConfig.update({
            ...appConfig.get(),
            workspace: state,
            filteredSurveys,
          });
        } else {
          throw workspace.error;
        }
      } catch (e) {
        console.error(`Error during expiry check: `, e);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update({
          ...existingConfig,
          workspace: {
            ...existingConfig.workspace,
            expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
          },
        });
      }
    };

    workspaceSyncIntervalId = window.setInterval(
      () => void intervalHandler(),
      updateInterval
    ) as unknown as number;
  }
};

export const clearWorkspaceStateExpiryCheckListener = (): void => {
  if (workspaceSyncIntervalId) {
    clearInterval(workspaceSyncIntervalId);
    workspaceSyncIntervalId = null;
  }
};
