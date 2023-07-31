import { TJsState } from "@formbricks/types/v1/js";
import { trackAction } from "./actions";
import { Config } from "./config";
import { NetworkError, Result, err, ok } from "./errors";

const config = Config.getInstance();

const syncWithBackend = async (): Promise<Result<TJsState, NetworkError>> => {
  const url = `${config.get().apiHost}/api/v1/js/sync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      environmentId: config.get().environmentId,
      personId: config.get().state?.person.id,
      sessionId: config.get().state?.session.id,
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

export const sync = async (): Promise<void> => {
  const syncResult = await syncWithBackend();
  if (syncResult.ok !== true) {
    throw syncResult.error;
  }
  const state = syncResult.value;
  const oldState = config.get().state;
  config.update({ state });
  // if session is new, track action
  if (!oldState?.session || oldState.session.id !== state.session.id) {
    const trackActionResult = await trackAction("New Session");
    if (trackActionResult.ok !== true) {
      throw trackActionResult.error;
    }
  }
};
