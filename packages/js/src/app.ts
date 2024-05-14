import { TFormbricksApp } from "@formbricks/js-core/app";
import { TFormbricksWebsite } from "@formbricks/js-core/website";

import { Result, wrapThrowsAsync } from "../../types/errorHandlers";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite;
  }
}

// load the sdk, return the result
const loadFormbricksAppSDK = async (apiHost: string): Promise<Result<void>> => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/app`);

    // failed to fetch the app package
    if (!res.ok) {
      return { ok: false, error: new Error("Failed to load Formbricks App SDK") };
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
          reject(new Error("Formbricks App SDK loading timed out"));
        }, 10000);
      });

    try {
      await getFormbricks();
      return { ok: true, data: undefined };
    } catch (error: any) {
      // formbricks loading failed, return the error
      return {
        ok: false,
        error: new Error(error.message ?? "Failed to load Formbricks App SDK"),
      };
    }
  }

  return { ok: true, data: undefined };
};

type FormbricksAppMethods = {
  [K in keyof TFormbricksApp]: TFormbricksApp[K] extends Function ? K : never;
}[keyof TFormbricksApp];

const formbricksProxyHandler: ProxyHandler<TFormbricksApp> = {
  get(_target, prop, _receiver) {
    return async (...args: any[]) => {
      if (!window.formbricks) {
        if (prop !== "init") {
          console.error(
            "🧱 Formbricks - Global error: You need to call formbricks.init before calling any other method"
          );
          return;
        }

        // still need to check if the apiHost is passed
        if (!args[0]) {
          console.error("🧱 Formbricks - Global error: You need to pass the apiHost as the first argument");
          return;
        }

        const { apiHost } = args[0];
        const loadSDKResult = await wrapThrowsAsync(loadFormbricksAppSDK)(apiHost);

        if (!loadSDKResult.ok) {
          console.error(`🧱 Formbricks - Global error: ${loadSDKResult.error.message}`);
          return;
        }
      }

      // @ts-expect-error
      if (window.formbricks && typeof window.formbricks[prop as FormbricksAppMethods] !== "function") {
        console.error(
          `🧱 Formbricks - Global error: Formbricks App SDK does not support method ${String(prop)}`
        );
        return;
      }

      try {
        // @ts-expect-error
        return (window.formbricks[prop as FormbricksAppMethods] as Function)(...args);
      } catch (error) {
        console.error(`Something went wrong: ${error}`);
        return;
      }
    };
  },
};

const formbricksApp: TFormbricksApp = new Proxy({} as TFormbricksApp, formbricksProxyHandler);
export default formbricksApp;
