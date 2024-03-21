declare global {
  interface Window {
    formbricks: any;
  }
}

const methodCallsInProgress = new Set();

const formbricksProxyHandler: ProxyHandler<any> = {
  get(_target, prop, _receiver) {
    return (...args: any[]) => {
      if (methodCallsInProgress.has(prop)) {
        console.warn(`🧱 Formbricks - Method ${String(prop)} is already being called`);
        return;
      }
      if (!window.formbricks) {
        const { apiHost } = args[0];
        fetch(`${apiHost}/api/packages/js`)
          .then((res) => (res.ok ? res.text() : Promise.reject("Failed to load Formbricks SDK")))
          .then((sdkScript) => {
            const scriptTag = document.createElement("script");
            scriptTag.innerHTML = sdkScript;
            document.head.appendChild(scriptTag);
            return new Promise((resolve, reject) => {
              const checkInterval = setInterval(() => {
                if (window.formbricks) {
                  clearInterval(checkInterval);
                  resolve(window.formbricks[prop](...args));
                }
              }, 100);
              setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error("Formbricks SDK loading timed out"));
              }, 10000);
            });
          })
          .catch((error) => {
            console.error(`🧱 Formbricks - Error loading SDK: ${error}`);
          });
        return;
      } else {
        if (typeof window.formbricks[prop] !== "function") {
          console.error(`🧱 Formbricks - SDK does not support method ${String(prop)}`);
          return;
        }
        methodCallsInProgress.add(prop);
        try {
          return window.formbricks[prop](...args);
        } finally {
          methodCallsInProgress.delete(prop);
        }
      }
    };
  },
};

const formbricks = new Proxy({}, formbricksProxyHandler);

export default formbricks;
