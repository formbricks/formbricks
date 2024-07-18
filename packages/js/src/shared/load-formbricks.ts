 

/* eslint-disable @typescript-eslint/no-unsafe-call --
 * Required for dynamic function calls
 */

/*
  eslint-disable no-console -- 
  * Required for logging errors
*/
import { type Result, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { MethodQueue } from "../method-queue";

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

    const getFormbricks = async (): Promise<void> =>
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
    } catch (error) {
      const err = error as { message?: string };

      return {
        ok: false,
        error: new Error(err.message ?? `Failed to load Formbricks ${sdkType} SDK`),
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

export const loadFormbricksToProxy = async (
  prop: string,
  sdkType: "app" | "website",
  ...args: unknown[]
  // eslint-disable-next-line @typescript-eslint/require-await -- Required for dynamic function calls
): Promise<void> => {
  const executeMethod = async (): Promise<unknown> => {
    try {
      if (window.formbricks) {
        // @ts-expect-error -- window.formbricks is a dynamic function
        return (await window.formbricks[prop](...args)) as unknown;
      }
    } catch (error: unknown) {
      console.error("🧱 Formbricks - Global error: ", error);
      throw error;
    }
  };

  if (!isInitialized) {
    if (isInitializing) {
      methodQueue.add(executeMethod);
    } else if (prop === "init") {
      isInitializing = true;

      const initialize = async (): Promise<unknown> => {
        const { apiHost } = args[0] as { apiHost: string };
        const loadSDKResult = (await wrapThrowsAsync(loadFormbricksSDK)(apiHost, sdkType)) as unknown as {
          ok: boolean;
          error: Error;
        };

        if (!loadSDKResult.ok) {
          isInitializing = false;
          console.error(`🧱 Formbricks - Global error: ${loadSDKResult.error.message}`);
          return;
        }

        try {
          if (window.formbricks) {
            // @ts-expect-error -- args is an array
            await window.formbricks[prop](...args);
            isInitialized = true;
            isInitializing = false;
          }
        } catch (error) {
          isInitializing = false;
          console.error("🧱 Formbricks - Global error: ", error);
          throw error;
        }
      };

      methodQueue.add(initialize);
    } else {
      console.error(
        "🧱 Formbricks - Global error: You need to call formbricks.init before calling any other method"
      );
    }
  } else {
    // @ts-expect-error -- window.formbricks is a dynamic function
    if (window.formbricks && typeof window.formbricks[prop] !== "function") {
      console.error(
        `🧱 Formbricks - Global error: Formbricks ${sdkType} SDK does not support method ${String(prop)}`
      );
      return;
    }

    methodQueue.add(executeMethod);
  }
};
