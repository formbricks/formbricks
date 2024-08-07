 

/* eslint-disable @typescript-eslint/no-unsafe-call --
 * Required for dynamic function calls
 */

/*
  eslint-disable no-console --
  * Required for logging errors
*/
import { type Result } from "@formbricks/types/error-handlers";
import { MethodQueue } from "../method-queue";

const methodQueue = new MethodQueue();

let isInitializing = false;
let isInitialized = false;
let apiHost: string | null = null;

// Load the SDK, return the result
const loadFormbricksSDK = async (apiHostParam: string, sdkType: "app" | "website"): Promise<Result<void>> => {
  if (!window.formbricks) {
    const res = await fetch(`${apiHostParam}/api/packages/${sdkType}`);

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

export const loadFormbricksToProxy = async (
  prop: string,
  sdkType: "app" | "website",
  ...args: unknown[]
): Promise<void> => {
  const executeMethod = async (): Promise<unknown> => {
    if (prop === "init") {
      if (isInitializing) {
        console.warn(
          "🧱 Formbricks - Warning: Initialization already in progress. Skipping redundant init call."
        );
        return;
      }

      // store the apiHost and reset isInitialized, isInitializing
      apiHost = (args[0] as { apiHost: string }).apiHost;
      isInitializing = true;
      isInitialized = false;
    } else if (!isInitialized) {
      return;
    }

    if (!window.formbricks && apiHost) {
      const loadSDKResult = await loadFormbricksSDK(apiHost, sdkType);
      if (!loadSDKResult.ok) {
        console.error(`🧱 Formbricks - Error: ${loadSDKResult.error.message}`);
        return;
      }
    }

    try {
      if (window.formbricks) {
        // @ts-expect-error -- Required for dynamic function calls
        await window.formbricks[prop](...args);

        // if the method was init, set isInitialized to true
        if (prop === "init") {
          isInitializing = false;
          isInitialized = true;
          void methodQueue.run();
        }
      }
    } catch (error: unknown) {
      console.error("🧱 Formbricks - Global error: ", error);
      throw error;
    }
  };

  if (prop === "init") {
    await executeMethod();
  } else if (isInitialized) {
    methodQueue.add(executeMethod);
  } else {
    console.warn(
      "🧱 Formbricks - Warning: Formbricks not initialized. This method will be queued and executed after initialization."
    );
    methodQueue.add(executeMethod, false);
  }
};
