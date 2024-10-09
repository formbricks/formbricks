let isInitializing = false;
let isInitialized = false;
const loadFormbricksSDK = async (apiHostParam) => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHostParam}/api/packages/js`);
    if (!res.ok) {
      return { ok: false, error: new Error(`Failed to load Formbricks SDK`) };
    }
    const sdkScript = await res.text();
    const scriptTag = document.createElement("script");
    scriptTag.innerHTML = sdkScript;
    document.head.appendChild(scriptTag);
    const getFormbricks = async () => new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.formbricks) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Formbricks SDK loading timed out`));
      }, 1e4);
    });
    try {
      await getFormbricks();
      return { ok: true, data: void 0 };
    } catch (error) {
      const err = error;
      return {
        ok: false,
        error: new Error(err.message ?? `Failed to load Formbricks SDK`)
      };
    }
  }
  return { ok: true, data: void 0 };
};
const functionsToProcess = [];
const loadFormbricksToProxy = async (prop, ...args) => {
  console.log(args);
  if (!isInitialized) {
    if (prop === "init") {
      if (isInitializing) {
        console.warn("🧱 Formbricks - Warning: Formbricks is already initializing.");
        return;
      }
      isInitializing = true;
      const apiHost = args[0].apiHost;
      const loadSDKResult = await loadFormbricksSDK(apiHost);
      if (loadSDKResult.ok) {
        if (window.formbricks) {
          void window.formbricks.init(...args);
          isInitializing = false;
          isInitialized = true;
          for (const { prop: functionProp, args: functionArgs } of functionsToProcess) {
            if (typeof window.formbricks[functionProp] !== "function") {
              console.error(`🧱 Formbricks - Error: Method ${functionProp} does not exist on formbricks`);
              continue;
            }
            window.formbricks[functionProp](...functionArgs);
          }
        }
      }
    } else {
      console.warn(
        "🧱 Formbricks - Warning: Formbricks not initialized. This method will be queued and executed after initialization."
      );
      functionsToProcess.push({ prop, args });
    }
  } else if (window.formbricks) {
    const functionPropTyped = prop;
    await window.formbricks[functionPropTyped](...args);
  }
};
const formbricksProxyHandler = {
  get(_target, prop, _receiver) {
    return (...args) => loadFormbricksToProxy(prop, ...args);
  }
};
const formbricksApp = new Proxy({}, formbricksProxyHandler);
export {
  formbricksApp as default
};
//# sourceMappingURL=index.js.map
