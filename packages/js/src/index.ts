declare global {
  interface Window {
    formbricks: any;
  }
}

const formbricksProxyHandler: ProxyHandler<any> = {
  get(_target, prop, _receiver) {
    return async (...args: any[]) => {
      if (!window.formbricks) {
        const { apiHost } = args[0];
        try {
          const res = await fetch(`${apiHost}/api/packages/js-core`);
          if (!res.ok) throw new Error("Failed to load Formbricks SDK");
          const sdkScript = await res.text();
          const scriptTag = document.createElement("script");
          scriptTag.innerHTML = sdkScript;
          document.head.appendChild(scriptTag);

          return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
              if (window.formbricks) {
                clearInterval(checkInterval);
                try {
                  resolve(await window.formbricks[prop](...args));
                } catch (e) {
                  reject(e);
                }
              }
            }, 100);
            setTimeout(() => {
              clearInterval(checkInterval);
              reject(new Error("Formbricks SDK loading timed out"));
            }, 10000);
          });
        } catch (error) {
          console.error(`🧱 Formbricks - Error loading SDK: ${error}`);
        }
      } else {
        if (typeof window.formbricks[prop] !== "function") {
          console.error(`🧱 Formbricks - SDK does not support method ${String(prop)}`);
          return;
        }
        try {
          return await window.formbricks[prop](...args);
        } catch (error) {
          console.error(error);
        }
      }
    };
  },
};

const formbricks = new Proxy({}, formbricksProxyHandler);

export default formbricks;
