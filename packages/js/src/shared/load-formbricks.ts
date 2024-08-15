/* eslint-disable @typescript-eslint/no-unsafe-call --
 * Required for dynamic function calls
 */

/*
  eslint-disable no-console --
  * Required for logging errors
*/
import { type Result } from "@formbricks/types/error-handlers";

let isInitializing = false;
let isInitialized = false;

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

const functionsToProcess: { prop: string; args: unknown[] }[] = [];

export const loadFormbricksToProxy = async (
  prop: string,
  sdkType: "app" | "website",
  ...args: unknown[]
): Promise<void> => {
  // all of this should happen when not initialized:
  if (!isInitialized) {
    if (prop === "init") {
      if (isInitializing) {
        console.warn("🧱 Formbricks - Warning: Formbricks is already initializing.");
        return;
      }

      // reset the initialization state
      isInitializing = true;

      const apiHost = (args[0] as { apiHost: string }).apiHost;
      const loadSDKResult = await loadFormbricksSDK(apiHost, sdkType);

      if (loadSDKResult.ok) {
        if (window.formbricks) {
          try {
            // @ts-expect-error -- Required for dynamic function calls
            await window.formbricks.init(...args);

            isInitializing = false;
            isInitialized = true;
          } catch (err) {
            console.error(`🧱 Formbricks - Error during Initializing: ${err as string}`);
            return;
          }

          // process the queued functions
          for (const { prop: functionProp, args: functionArgs } of functionsToProcess) {
            if (
              // @ts-expect-error -- Required for dynamic function calls
              window.formbricks[functionProp] === undefined ||
              // @ts-expect-error -- Required for dynamic function calls
              typeof window.formbricks[functionProp] !== "function"
            ) {
              console.error(`🧱 Formbricks - Error: Method ${functionProp} does not exist on formbricks`);
              continue;
            }

            // @ts-expect-error -- Required for dynamic function calls
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
    // @ts-expect-error -- Required for dynamic function calls
    await window.formbricks[prop](...args);
  }
};
