import type { ITransport } from "@cubejs-client/core";

/**
 * A Cube client transport that answers every request with `responseBody`, so a real `CubeApi` parses a
 * canned `/load` response — and applies its own options such as `castNumerics` — without a network.
 */
export const createCubeTransport = (responseBody: unknown): ITransport<Response> => ({
  authorization: undefined,
  request: () => ({
    subscribe: <T>(callback: (result: Response, resubscribe: () => Promise<T>) => T) =>
      new Promise<T>((resolve) => {
        resolve(
          callback(new Response(JSON.stringify(responseBody)), () =>
            Promise.reject(new Error("unexpected resubscribe"))
          )
        );
      }),
  }),
});
