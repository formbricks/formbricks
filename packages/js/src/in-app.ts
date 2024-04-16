import { TFormbricksInApp } from "@formbricks/js-core/in-app";
import { TFormbricksWebsite } from "@formbricks/js-core/website";

declare global {
  interface Window {
    formbricks: TFormbricksInApp | TFormbricksWebsite;
  }
}

let sdkLoadingPromise: Promise<void> | null = null;
let isErrorLoadingSdk = false;

async function loadSDK(apiHost: string) {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/in-app`);
    if (!res.ok) throw new Error("Failed to load Formbricks In-App SDK");
    const sdkScript = await res.text();
    const scriptTag = document.createElement("script");
    scriptTag.innerHTML = sdkScript;
    document.head.appendChild(scriptTag);

    return new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.formbricks) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Formbricks SDK loading timed out"));
      }, 10000);
    });
  }
}

type FormbricksInAppMethods = {
  [K in keyof TFormbricksInApp]: TFormbricksInApp[K] extends Function ? K : never;
}[keyof TFormbricksInApp];

const formbricksProxyHandler: ProxyHandler<TFormbricksInApp> = {
  get(_target, prop, _receiver) {
    return async (...args: any[]) => {
      if (!window.formbricks && !sdkLoadingPromise && !isErrorLoadingSdk) {
        const { apiHost } = args[0];
        sdkLoadingPromise = loadSDK(apiHost).catch((error) => {
          console.error(`🧱 Formbricks - Error loading SDK: ${error}`);
          sdkLoadingPromise = null;
          isErrorLoadingSdk = true;
          return;
        });
      }

      if (isErrorLoadingSdk) {
        return;
      }

      if (sdkLoadingPromise) {
        await sdkLoadingPromise;
      }

      if (!window.formbricks) {
        throw new Error("Formbricks In-App SDK is not available");
      }

      // @ts-expect-error
      if (typeof window.formbricks[prop as FormbricksInAppMethods] !== "function") {
        console.error(`🧱 Formbricks In-App SDK does not support method ${String(prop)}`);
        return;
      }

      try {
        // @ts-expect-error
        return (window.formbricks[prop as FormbricksInAppMethods] as Function)(...args);
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
  },
};

const formbricksInApp: TFormbricksInApp = new Proxy({} as TFormbricksInApp, formbricksProxyHandler);
export default formbricksInApp;
