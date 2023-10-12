import { TJsState, TJsSyncParams } from "@formbricks/types/v1/js";
import { trackAction } from "./actions";
import { Config } from "./config";
import { NetworkError, Result, err, ok } from "./errors";
import { Logger } from "./logger";
import packageJson from "../../package.json";

const config = Config.getInstance();
const logger = Logger.getInstance();

let syncIntervalId: number | null = null;

const syncWithBackend = async ({
  apiHost,
  environmentId,
  personId,
  sessionId,
}: TJsSyncParams): Promise<Result<TJsState, NetworkError>> => {
  const url = `${apiHost}/api/v1/js/sync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      environmentId,
      personId,
      sessionId,
      jsVersion: packageJson.version,
    }),
  });
  if (!response.ok) {
    const jsonRes = await response.json();

    return err({
      code: "network_error",
      status: response.status,
      message: "Error syncing with backend",
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok((await response.json()).data as TJsState);
};

export const sync = async (params: TJsSyncParams): Promise<void> => {
  try {
    const syncResult = await syncWithBackend(params);
    if (syncResult?.ok !== true) {
      logger.error(`Sync failed: ${syncResult.error}`);
      return;
    }

    const state = syncResult.value;
    let oldState: TJsState | undefined;
    try {
      oldState = config.get().state;
    } catch (e) {
      // ignore error
    }
    config.update({
      apiHost: params.apiHost,
      environmentId: params.environmentId,
      state,
    });
    const surveyNames = state.surveys.map((s) => s.name);
    logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));

    // if session is new, track action
    if (!oldState?.session || oldState.session.id !== state.session.id) {
      const trackActionResult = await trackAction("New Session");
      if (trackActionResult.ok !== true) {
        logger.error(`Action tracking failed: ${trackActionResult.error}`);
      }
    }
  } catch (error) {
    logger.error(`Error during sync: ${error}`);
  }
};

export const addSyncEventListener = (debug: boolean = false): void => {
  const updateInterval = debug ? 1000 * 60 : 1000 * 60 * 5; // 5 minutes in production, 1 minute in debug mode
  // add event listener to check sync with backend on regular interval
  if (typeof window !== "undefined" && syncIntervalId === null) {
    syncIntervalId = window.setInterval(async () => {
      await sync({
        apiHost: config.get().apiHost,
        environmentId: config.get().environmentId,
        personId: config.get().state?.person?.id,
        sessionId: config.get().state?.session?.id,
      });
    }, updateInterval);
  }
};

export const removeSyncEventListener = (): void => {
  if (typeof window !== "undefined" && syncIntervalId !== null) {
    window.clearInterval(syncIntervalId);

    syncIntervalId = null;
  }
};
