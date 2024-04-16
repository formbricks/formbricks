import { TFormbricksWebsite } from "@formbricks/js-core/dist/website";

let sdkLoadingPromise: Promise<void> | null = null;
let isErrorLoadingSdk = false;

async function loadSDK(apiHost: string) {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/website`);
    if (!res.ok) throw new Error("Failed to load Formbricks Website SDK");
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

type FormbricksWebsiteMethods = {
  [K in keyof TFormbricksWebsite]: TFormbricksWebsite[K] extends Function ? K : never;
}[keyof TFormbricksWebsite];

const formbricksProxyHandler: ProxyHandler<TFormbricksWebsite> = {
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
        throw new Error("Formbricks Website SDK is not available");
      }

      if (typeof window.formbricks[prop as FormbricksWebsiteMethods] !== "function") {
        console.error(`🧱 Formbricks Website SDK does not support method ${String(prop)}`);
        return;
      }

      try {
        return (window.formbricks[prop as FormbricksWebsiteMethods] as Function)(...args);
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
  },
};

const formbricksWebsite: TFormbricksWebsite = new Proxy({} as TFormbricksWebsite, formbricksProxyHandler);
export default formbricksWebsite;
