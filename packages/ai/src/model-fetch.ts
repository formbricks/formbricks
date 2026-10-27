import { type Dispatcher, getGlobalDispatcher } from "undici";
import { AI_MODEL_HTTP_TIMEOUT_MS } from "@formbricks/types/ai-timeout";

// Reuse the configured route and its connection pools, including a globally installed proxy.
// Only model requests receive extended transport limits; the SDK's total timeout remains authoritative.
const modelDispatchers = new WeakMap<Dispatcher, Dispatcher>();

const getModelDispatcher = (): Dispatcher => {
  const dispatcher = getGlobalDispatcher();
  let modelDispatcher = modelDispatchers.get(dispatcher);
  if (!modelDispatcher) {
    modelDispatcher = dispatcher.compose(
      (dispatch) => (options, handler) =>
        dispatch(
          {
            ...options,
            headersTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
            bodyTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
          },
          handler
        )
    );
    modelDispatchers.set(dispatcher, modelDispatcher);
  }
  return modelDispatcher;
};

export const modelFetch: typeof fetch = (input, init) => {
  const modelInit: RequestInit & { dispatcher: Dispatcher } = { ...init, dispatcher: getModelDispatcher() };
  return globalThis.fetch(input, modelInit);
};
