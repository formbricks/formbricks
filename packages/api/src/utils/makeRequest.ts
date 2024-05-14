import { Result, err, ok, wrapThrows } from "@formbricks/types/errorHandlers";
import { NetworkError } from "@formbricks/types/errors";

export const makeRequest = async <T>(
  apiHost: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: any
): Promise<Result<T, NetworkError | Error>> => {
  const url = new URL(endpoint, apiHost);
  const body = JSON.stringify(data);

  const res = wrapThrows(fetch)(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  if (res.ok === false) return err(res.error);

  const response = await res.data;
  const json = await response.json();

  if (!response.ok) {
    return err({
      code: "network_error",
      status: response.status,
      message: json.message || "Something went wrong",
      url,
      ...(json.details && { details: json.details }),
    });
  }

  return ok(json.data as T);
};
