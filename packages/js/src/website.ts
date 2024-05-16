import { TFormbricksApp } from "@formbricks/js-core/app";
import { TFormbricksWebsite } from "@formbricks/js-core/website";

import { Result, wrapThrowsAsync } from "../../types/errorHandlers";
import { MethodQueue } from "./methodQueue";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite;
  }
}

let isInitializing = false;
let isInitialized = false;

// Load the SDK, return the result
const loadFormbricksWebsiteSDK = async (apiHost: string): Promise<Result<void>> => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/website`);

    // Failed to fetch the app package
    if (!res.ok) {
      return { ok: false, error: new Error("Failed to load Formbricks Website SDK") };
    }

    const sdkScript = await res.text();
    const scriptTag = document.createElement("script");
    scriptTag.innerHTML = sdkScript;
    document.head.appendChild(scriptTag);

    const getFormbricks = async () =>
      new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (window.formbricks) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error("Formbricks Website SDK loading timed out"));
        }, 10000);
      });

    try {
      await getFormbricks();
      return { ok: true, data: undefined };
    } catch (error: any) {
      // Formbricks loading failed, return the error
      return {
        ok: false,
        error: new Error(error.message ?? "Failed to load Formbricks Website SDK"),
      };
    }
  }

  return { ok: true, data: undefined };
};

type FormbricksWebsiteMethods = {
  [K in keyof TFormbricksWebsite]: TFormbricksWebsite[K] extends Function ? K : never;
}[keyof TFormbricksWebsite];

const formbricksProxyHandler: ProxyHandler<TFormbricksWebsite> = {
  get(_target, prop, _receiver) {
    return async (...args: any[]) => {
      const methodQueue = new MethodQueue();

      if (prop === "init") {
        // if still initializing, return
        if (isInitializing) {
          return;
        }

        // mark as initializing
        isInitializing = true;

        const { apiHost } = args[0];
        const loadSDKResult = await wrapThrowsAsync(loadFormbricksWebsiteSDK)(apiHost);

        if (!loadSDKResult.ok) {
          // error loading the SDK
          isInitializing = false;
          console.error(`🧱 Formbricks - Global error: ${loadSDKResult.error.message}`);
          return;
        }

        try {
          const result = await (
            (window.formbricks as TFormbricksWebsite)[prop as FormbricksWebsiteMethods] as Function
          )(...args);

          // mark as initialized
          isInitializing = false;
          isInitialized = true;

          // run the method queue
          methodQueue.run();

          // clear the method queue
          methodQueue.clear();
          return result;
        } catch (error) {
          isInitializing = false;
          console.error(`🧱 Formbricks - Global error: ${error}`);
          throw error;
        }
      }

      if (!isInitialized) {
        if (!isInitializing) {
          console.error(
            "🧱 Formbricks - Global error: You need to call formbricks.init before calling any other method"
          );
          return;
        }

        return new Promise<void>((resolve) => {
          const method = async () => {
            try {
              const result = await (
                (window.formbricks as TFormbricksWebsite)[prop as FormbricksWebsiteMethods] as Function
              )(...args);
              resolve(result);
            } catch (error) {
              console.error(`🧱 Formbricks - Global error: ${error}`);
            }
          };

          methodQueue.add(method);
        });
      }

      if (
        window.formbricks &&
        typeof (window.formbricks as TFormbricksWebsite)[prop as FormbricksWebsiteMethods] !== "function"
      ) {
        console.error(
          `🧱 Formbricks - Global error: Formbricks Website SDK does not support method ${String(prop)}`
        );
        return;
      }

      try {
        return ((window.formbricks as TFormbricksWebsite)[prop as FormbricksWebsiteMethods] as Function)(
          ...args
        );
      } catch (error) {
        console.error(`🧱 Formbricks - Global error: ${error}`);
        throw error;
      }
    };
  },
};

const formbricksWebsite: TFormbricksWebsite = new Proxy({} as TFormbricksWebsite, formbricksProxyHandler);
export default formbricksWebsite;
