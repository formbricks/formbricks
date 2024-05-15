import { TFormbricksApp } from "@formbricks/js-core/app";
import { TFormbricksWebsite } from "@formbricks/js-core/website";

import { Result, wrapThrowsAsync } from "../../types/errorHandlers";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite;
  }
}

// load the sdk, return the result
const loadFormbricksWebsiteSDK = async (apiHost: string): Promise<Result<void>> => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/website`);

    // failed to fetch the app package
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
      // formbricks loading failed, return the error
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
        const loadSDKResult = await wrapThrowsAsync(loadFormbricksWebsiteSDK)(apiHost);

        if (!loadSDKResult.ok) {
          console.error(`🧱 Formbricks - Global error: ${loadSDKResult.error.message}`);
          return;
        }
      }

      if (window.formbricks && typeof window.formbricks[prop as FormbricksWebsiteMethods] !== "function") {
        console.error(
          `🧱 Formbricks - Global error: Formbricks Website SDK does not support method ${String(prop)}`
        );
        return;
      }

      try {
        return (window.formbricks[prop as FormbricksWebsiteMethods] as Function)(...args);
      } catch (error) {
        console.error(`🧱 Formbricks - Global error: Something went wrong: ${error}`);
        return;
      }
    };
  },
};

const formbricksApp: TFormbricksWebsite = new Proxy({} as TFormbricksWebsite, formbricksProxyHandler);
export default formbricksApp;
