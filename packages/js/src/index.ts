declare global {
  interface Window {
    formbricks: any;
  }
}

interface InitOptions {
  apiHost: string;
  environmentId: string;
  [key: string]: any; // Allows any additional properties required in the future
}

const methodCallsInProgress = new Set();

const formbricksProxyHandler: ProxyHandler<any> = {
  get(target, prop, _receiver) {
    if (prop === "init") {
      return target[prop];
    }
    return (...args: any[]) => {
      if (methodCallsInProgress.has(prop)) {
        throw new Error(`Method ${String(prop)} is already being called`);
      }
      if (!window.formbricks) {
        throw new Error("Formbricks SDK is not initialized");
      }
      if (typeof window.formbricks[prop] !== "function") {
        throw new Error(`Formbricks SDK does not support method ${String(prop)}`);
      }
      methodCallsInProgress.add(prop);
      try {
        return window.formbricks[prop](...args);
      } finally {
        methodCallsInProgress.delete(prop);
      }
    };
  },
};

const formbricks = new Proxy(
  {
    init: async (options: InitOptions) => {
      const { apiHost } = options;
      await fetch(`${apiHost}/api/js`)
        .then((res) => (res.ok ? res.text() : Promise.reject("Failed to load Formbricks SDK")))
        .then((sdkScript) => {
          const scriptTag = document.createElement("script");
          scriptTag.innerHTML = sdkScript;
          document.head.appendChild(scriptTag);
          return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
              if (window.formbricks) {
                clearInterval(checkInterval);
                resolve(true);
              }
            }, 100);
            setTimeout(() => {
              clearInterval(checkInterval);
              reject(new Error("Formbricks SDK loading timed out"));
            }, 10000);
          });
        });

      if (window.formbricks) {
        window.formbricks.init(options);
      }
    },
  },
  formbricksProxyHandler
);

export default formbricks;
