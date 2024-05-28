import { Result, wrapThrowsAsync } from "../../../types/errorHandlers";
import { MethodQueue } from "../methodQueue";

let isInitializing = false;
let isInitialized = false;
const methodQueue = new MethodQueue();

// Load the SDK, return the result
const loadFormbricksSDK = async (apiHost: string, sdkType: "app" | "website"): Promise<Result<void>> => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHost}/api/packages/${sdkType}`);

    // Failed to fetch the app package
    if (!res.ok) {
      return { ok: false, error: new Error(`Failed to load Formbricks ${sdkType} SDK`) };
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
          reject(new Error(`Formbricks ${sdkType} SDK loading timed out`));
        }, 10000);
      });

    try {
      await getFormbricks();
      return { ok: true, data: undefined };
    } catch (error: any) {
      return {
        ok: false,
        error: new Error(error.message ?? `Failed to load Formbricks ${sdkType} SDK`),
      };
    }
  }

  return { ok: true, data: undefined };
};

// TODO: @pandeymangg - Fix these types
// type FormbricksAppMethods = {
//   [K in keyof TFormbricksApp]: TFormbricksApp[K] extends Function ? K : never;
// }[keyof TFormbricksApp];

// type FormbricksWebsiteMethods = {
//   [K in keyof TFormbricksWebsite]: TFormbricksWebsite[K] extends Function ? K : never;
// }[keyof TFormbricksWebsite];

export const loadFormbricksToProxy = async (prop: string, sdkType: "app" | "website", ...args: any[]) => {
  const executeMethod = async () => {
    try {
      //  @ts-expect-error
      return await (window.formbricks[prop] as Function)(...args);
    } catch (error) {
      console.error(`🧱 Formbricks - Global error: ${error}`);
      throw error;
    }
  };

  if (!isInitialized) {
    if (isInitializing) {
      methodQueue.add(executeMethod);
    } else {
      if (prop === "init") {
        isInitializing = true;

        const initialize = async () => {
          const { apiHost } = args[0];
          const loadSDKResult = await wrapThrowsAsync(loadFormbricksSDK)(apiHost, sdkType);

          if (!loadSDKResult.ok) {
            isInitializing = false;
            console.error(`🧱 Formbricks - Global error: ${loadSDKResult.error.message}`);
            return;
          }

          try {
            const result = await (window.formbricks[prop] as Function)(...args);
            isInitialized = true;
            isInitializing = false;

            return result;
          } catch (error) {
            isInitializing = false;
            console.error(`🧱 Formbricks - Global error: ${error}`);
            throw error;
          }
        };

        methodQueue.add(initialize);
      } else {
        console.error(
          "🧱 Formbricks - Global error: You need to call formbricks.init before calling any other method"
        );
        return;
      }
    }
  } else {
    // @ts-expect-error
    if (window.formbricks && typeof window.formbricks[prop] !== "function") {
      console.error(
        `🧱 Formbricks - Global error: Formbricks ${sdkType} SDK does not support method ${String(prop)}`
      );
      return;
    }

    methodQueue.add(executeMethod);
    return;
  }
};
