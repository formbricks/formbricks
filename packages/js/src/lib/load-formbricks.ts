/*
  eslint-disable no-console --
  * Required for logging errors
*/
import { type Result } from "@formbricks/types/error-handlers";

let isInitializing = false;
let isInitialized = false;

// Load the SDK, return the result
const loadFormbricksSDK = async (apiHostParam: string): Promise<Result<void>> => {
  if (!window.formbricks) {
    const scriptTag = document.createElement("script");
    scriptTag.type = "text/javascript";
    scriptTag.src = `${apiHostParam}/js/formbricks.umd.cjs`;
    scriptTag.async = true;

    const getFormbricks = async (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Formbricks SDK loading timed out`));
        }, 10000);
        scriptTag.onload = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        scriptTag.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to load Formbricks SDK`));
        };
      });

    document.head.appendChild(scriptTag);

    try {
      await getFormbricks();
      return { ok: true, data: undefined };
    } catch (error) {
      const err = error as { message?: string };

      return {
        ok: false,
        error: new Error(err.message ?? `Failed to load Formbricks SDK`),
      };
    }
  }

  return { ok: true, data: undefined };
};

const functionsToProcess: { prop: string; args: unknown[] }[] = [];

export const loadFormbricksToProxy = async (prop: string, ...args: unknown[]): Promise<void> => {
  // all of this should happen when not initialized:
  if (!isInitialized) {
    if (prop === "init") {
      if (isInitializing) {
        console.warn("🧱 Formbricks - Warning: Formbricks is already initializing.");
        return;
      }

      // reset the initialization state
      isInitializing = true;

      const argsTyped = args[0] as { appUrl?: string; environmentId?: string; apiHost?: string };
      const appUrl = argsTyped.appUrl ?? argsTyped.apiHost;

      if (!appUrl) {
        console.error("🧱 Formbricks - Error: appUrl is required");
        return;
      }

      if (!argsTyped.environmentId) {
        console.error("🧱 Formbricks - Error: environmentId is required");
        return;
      }

      const loadSDKResult = await loadFormbricksSDK(appUrl);

      if (loadSDKResult.ok) {
        if (window.formbricks) {
          const formbricksInstance = window.formbricks;
          // @ts-expect-error -- Required for dynamic function calls
          void formbricksInstance.init(...args);

          isInitializing = false;
          isInitialized = true;

          // process the queued functions
          for (const { prop: functionProp, args: functionArgs } of functionsToProcess) {
            if (typeof formbricksInstance[functionProp as keyof typeof formbricksInstance] !== "function") {
              console.error(`🧱 Formbricks - Error: Method ${functionProp} does not exist on formbricks`);
              continue;
            }

            // @ts-expect-error -- Required for dynamic function calls
            (formbricksInstance[functionProp] as unknown)(...functionArgs);
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
    // Access the default export for initialized state too
    const formbricksInstance = window.formbricks;
    type Formbricks = typeof formbricksInstance;
    type FunctionProp = keyof Formbricks;
    const functionPropTyped = prop as FunctionProp;

    // @ts-expect-error -- Required for dynamic function calls
    await formbricksInstance[functionPropTyped](...args);
  }
};
