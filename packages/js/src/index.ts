declare global {
  interface Window {
    formbricksJsCore: any;
  }
}

let sdkLoadingPromise: Promise<void> | null = null;
let isErrorLoadingSdk = false;

async function loadSDK(apiHost: string) {
  if (!window.formbricksJsCore) {
    const res = await fetch(`${apiHost}/api/packages/js-core`);
    if (!res.ok) throw new Error("Failed to load Formbricks SDK");
    const sdkScript = await res.text();
    const scriptTag = document.createElement("script");
    scriptTag.innerHTML = sdkScript;
    document.head.appendChild(scriptTag);

    return new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.formbricksJsCore) {
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

const formbricksProxyHandler: ProxyHandler<any> = {
  get(_target, prop, _receiver) {
    return async (...args: any[]) => {
      if (!window.formbricksJsCore && !sdkLoadingPromise && !isErrorLoadingSdk) {
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

      if (!window.formbricksJsCore) {
        throw new Error("Formbricks SDK is not available");
      }

      if (typeof window.formbricksJsCore[prop] !== "function") {
        console.error(`🧱 Formbricks - SDK does not support method ${String(prop)}`);
        return;
      }

      try {
        return window.formbricksJsCore[prop](...args);
        return;
      } catch (error) {
        console.error(error);
        throw error;
      }
    };
  },
};

const formbricks = new Proxy({}, formbricksProxyHandler);

export default formbricks;
