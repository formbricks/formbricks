import { TJsState } from "@formbricks/types/v1/js";
import { Config } from "./config";
import { NetworkError, Result, err, ok } from "./errors";
import { Logger } from "./logger";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const sync = async (): Promise<Result<TJsState, NetworkError>> => {
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
