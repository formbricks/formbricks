import { FormbricksType } from "@formbricks/js-core";

declare global {
  interface Window {
    formbricks: FormbricksType;
  }
}

let sdkLoadingPromise: Promise<void> | null = null;
let isErrorLoadingSdk = false;

async function loadSDK(apiHost: string) {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/js-core`);
    if (!res.ok) throw new Error("Failed to load Formbricks SDK");
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

type FormbricksMethods = {
  [K in keyof FormbricksType]: FormbricksType[K] extends Function ? K : never;
}[keyof FormbricksType];

const formbricksProxyHandler: ProxyHandler<FormbricksType> = {
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
        throw new Error("Formbricks SDK is not available");
      }

      if (typeof window.formbricks[prop as FormbricksMethods] !== "function") {
        console.error(`🧱 Formbricks - SDK does not support method ${String(prop)}`);
        return;
      }

      try {
        return (window.formbricks[prop as FormbricksMethods] as Function)(...args);
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
  },
};

const formbricks: FormbricksType = new Proxy({} as FormbricksType, formbricksProxyHandler);

export default formbricks;
