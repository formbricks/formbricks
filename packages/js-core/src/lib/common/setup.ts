import { Config } from "@/lib/common/config";
import { JS_LOCAL_STORAGE_KEY } from "@/lib/common/constants";
import { addCleanupEventListeners, addEventListeners } from "@/lib/common/event-listeners";
import { Logger } from "@/lib/common/logger";
import { getIsSetup, setIsSetup } from "@/lib/common/status";
import { filterSurveys, getIsDebug, isNowExpired, wrapThrows } from "@/lib/common/utils";
import { addLiveRegionContainer, closeSurvey, prefetchSurveysScript } from "@/lib/survey/widget";
import { DEFAULT_USER_STATE_NO_USER_ID } from "@/lib/user/state";
import { sendUpdatesToBackend } from "@/lib/user/update";
import { fetchWorkspaceState } from "@/lib/workspace/state";
import {
  type TConfig,
  type TConfigInput,
  type TLegacyConfig,
  type TUserState,
  type TWorkspaceState,
} from "@/types/config";
import {
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type Result,
  err,
  okVoid,
} from "@/types/error";

const migrateLocalStorage = (): { changed: boolean; newState?: TLegacyConfig } => {
  const existingConfig = localStorage.getItem(JS_LOCAL_STORAGE_KEY);

  if (existingConfig) {
    let parsedConfig = JSON.parse(existingConfig) as TLegacyConfig;
    let changed = false;

    // Migrate intermediate format: environmentId → workspaceId, environment → workspace
    if (parsedConfig.environmentId ?? parsedConfig.environment) {
      const { environmentId, environment, ...rest } = parsedConfig;
      const workspace = environment
        ? (() => {
            const envData = environment.data as unknown as Record<string, unknown>;
            const migratedData = { ...envData };

            if (migratedData.project) {
              migratedData.settings = migratedData.project;
              delete migratedData.project;
            }

            if (migratedData.workspace) {
              migratedData.settings = migratedData.workspace;
              delete migratedData.workspace;
            }
            return { ...environment, data: migratedData };
          })()
        : undefined;

      parsedConfig = {
        ...rest,
        workspaceId: environmentId ?? (rest as unknown as TConfig).workspaceId,
        ...(workspace && { workspace }),
      } as TLegacyConfig;
      changed = true;
    }

    if (changed) {
      return { changed: true, newState: parsedConfig };
    }
  }

  return { changed: false };
};

/**
 * Rebuild a legacy `user` into a complete `TUserState`.
 *
 * A legacy blob is unchecked JSON: `data` can be absent, or present with missing fields or wrong
 * types. Spreading it over the default is not enough on its own — a spread only fills keys that are
 * absent, so a stored `displays: null` would win over the default and reach `filterSurveys`, which
 * calls `.filter` on it. The three fields it destructures as arrays are therefore type-checked.
 *
 * A repaired state is marked already-expired rather than trusted, because a half-empty one is not
 * merely incomplete, it is wrong: an identified user completed to `segments: []` is filtered down
 * to no surveys at all. Expiring it makes setup re-sync instead of rendering nothing.
 */
const completeLegacyUserState = (legacyUser: TLegacyConfig["user"]): TUserState => {
  const legacyData = legacyUser?.data;

  if (!legacyData) {
    return DEFAULT_USER_STATE_NO_USER_ID;
  }

  const defaults = DEFAULT_USER_STATE_NO_USER_ID.data;
  const wasRepaired =
    !Array.isArray(legacyData.segments) ||
    !Array.isArray(legacyData.displays) ||
    !Array.isArray(legacyData.responses);

  return {
    // `new Date(0)` reads as expired wherever `expiresAt` is checked, which is what forces the sync.
    expiresAt: wasRepaired ? new Date(0) : (legacyUser.expiresAt ?? null),
    data: {
      ...defaults,
      ...legacyData,
      segments: Array.isArray(legacyData.segments) ? legacyData.segments : defaults.segments,
      displays: Array.isArray(legacyData.displays) ? legacyData.displays : defaults.displays,
      responses: Array.isArray(legacyData.responses) ? legacyData.responses : defaults.responses,
    },
  };
};

export const setup = async (
  configInput: TConfigInput | (TConfigInput & { userId: string; attributes: Record<string, string> })
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  const isDebug = getIsDebug();
  const logger = Logger.getInstance();

  if (isDebug) {
    logger.configure({ logLevel: "debug" });
  }

  let config = Config.getInstance();

  const { changed, newState } = migrateLocalStorage();

  if (changed) {
    config.resetConfig();
    config = Config.getInstance();

    // Persist the migrated state for every legacy config, identified or not. `resetConfig()` has
    // just wiped storage, so skipping the write leaves no config at all and the fresh-setup path
    // below would silently downgrade an identified user to anonymous.
    if (newState) {
      config.update({ ...newState, user: completeLegacyUserState(newState.user) });
    }
  }

  if (getIsSetup()) {
    logger.debug("Already set up, skipping setup.");
    return okVoid();
  }

  let existingConfig: TConfig | undefined;
  try {
    existingConfig = config.get();
    logger.debug("Found existing configuration.");
  } catch {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip setup
  if (existingConfig?.status.value === "error") {
    if (isDebug) {
      logger.debug(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
      config.resetConfig();
      return okVoid();
    }

    console.error("🧱 Formbricks - Formbricks was set to an error state.");

    const expiresAt = existingConfig.status.expiresAt;

    if (expiresAt && !isNowExpired(new Date(expiresAt))) {
      console.error("🧱 Formbricks - Error state is not expired, skipping initialization");
      return okVoid();
    }
    console.error("🧱 Formbricks - Error state is expired. Continuing with initialization.");
  }

  logger.debug("Start setup");

  // Resolve effective ID: prefer workspaceId, fall back to environmentId
  const effectiveId = configInput.workspaceId ?? configInput.environmentId;

  if (!effectiveId) {
    logger.debug("No workspaceId or environmentId provided");
    return err({
      code: "missing_field",
      field: "workspaceId",
    });
  }

  if (configInput.environmentId && !configInput.workspaceId) {
    logger.debug(
      "environmentId is deprecated and will be removed in a future version. Please use workspaceId instead."
    );
  }

  if (!configInput.appUrl) {
    logger.debug("No appUrl provided");

    return err({
      code: "missing_field",
      field: "appUrl",
    });
  }

  if (
    existingConfig?.workspace &&
    existingConfig.workspaceId === effectiveId &&
    existingConfig.appUrl === configInput.appUrl
  ) {
    logger.debug("Configuration fits setup parameters.");
    let isWorkspaceStateExpired = false;
    let isUserStateExpired = false;

    const workspaceExpiresAt = new Date(existingConfig.workspace.expiresAt);

    if (isNowExpired(workspaceExpiresAt)) {
      logger.debug("Workspace state expired. Syncing.");
      isWorkspaceStateExpired = true;
    }

    if (existingConfig.user.expiresAt && isNowExpired(new Date(existingConfig.user.expiresAt))) {
      logger.debug("User state expired. Syncing.");
      isUserStateExpired = true;
    }

    try {
      // fetch the workspace state (if expired)
      let workspace: TWorkspaceState = existingConfig.workspace;
      let userState: TUserState = existingConfig.user;

      if (isWorkspaceStateExpired || isDebug) {
        if (isDebug) {
          logger.debug("Debug mode is active, refetching workspace state");
        }

        const workspaceResponse = await fetchWorkspaceState({
          appUrl: configInput.appUrl,
          workspaceId: effectiveId,
        });

        if (workspaceResponse.ok) {
          workspace = workspaceResponse.data;
          logger.debug(`Fetched ${workspace.data.surveys.length.toString()} surveys from the backend`);
        } else {
          logger.error(
            `Error fetching workspace state: ${workspaceResponse.error.code} - ${workspaceResponse.error.responseMessage ?? ""}`
          );
          return err({
            code: "network_error",
            message: "Error fetching workspace state",
            status: 500,
            url: new URL(`${configInput.appUrl}/api/v1/client/${effectiveId}/environment`),
            responseMessage: workspaceResponse.error.message,
          });
        }
      }

      if (isUserStateExpired || isDebug) {
        // If the existing person state (expired) has a userId, we need to fetch the person state
        // If the existing person state (expired) has no userId, we need to set the person state to the default

        if (isDebug) {
          logger.debug("Debug mode is active, refetching user state");
        }

        if (userState.data.userId) {
          const updatesResponse = await sendUpdatesToBackend({
            appUrl: configInput.appUrl,
            workspaceId: effectiveId,
            updates: {
              userId: userState.data.userId,
            },
          });

          if (updatesResponse.ok) {
            userState = updatesResponse.data.state;
          } else {
            logger.error(
              `Error updating user state: ${updatesResponse.error.code} - ${updatesResponse.error.responseMessage ?? ""}`
            );
            return err({
              code: "network_error",
              message: "Error updating user state",
              status: 500,
              url: new URL(
                `${configInput.appUrl}/api/v1/client/${effectiveId}/update/contacts/${userState.data.userId}`
              ),
              responseMessage: "Unknown error",
            });
          }
        } else if (!isDebug) {
          userState = DEFAULT_USER_STATE_NO_USER_ID;
        }
      }

      // filter the workspace state wrt the person state
      const filteredSurveys = filterSurveys(workspace, userState);

      // update the appConfig with the new filtered surveys and person state
      config.update({
        ...existingConfig,
        workspace,
        user: userState,
        filteredSurveys,
      });

      const surveyIds = filteredSurveys.map((s) => s.id);
      logger.debug(
        `${surveyIds.length.toString()} surveys could be shown to current user on trigger: ${surveyIds.join(", ")}`
      );
    } catch {
      logger.debug("Error during sync. Please try again.");
    }
  } else {
    logger.debug("No valid configuration found. Resetting config and creating new one.");
    config.resetConfig();
    logger.debug("Syncing.");

    // During setup, if we don't have a valid config, we need to fetch the workspace state
    // but not the person state, we can set it to the default value.
    // The person state will be fetched when the `setUserId` method is called.

    try {
      const workspaceResponse = await fetchWorkspaceState({
        appUrl: configInput.appUrl,
        workspaceId: effectiveId,
      });

      if (!workspaceResponse.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- the catch below feeds this structured ApiErrorResponse (code/responseMessage) to handleErrorOnFirstSetup
        throw workspaceResponse.error;
      }

      let userState: TUserState = DEFAULT_USER_STATE_NO_USER_ID;

      // A migrated legacy config reaches this branch whenever it carried no workspace state to
      // reuse. It can still carry an identified user, so fall back to that id when setup was not
      // given one — otherwise the migration would turn an identified user into an anonymous one.
      // Scoped to the config the migration just wrote: another workspace or app URL is another
      // integration, and its user must not be carried across.
      const migratedUser =
        changed && existingConfig?.workspaceId === effectiveId && existingConfig.appUrl === configInput.appUrl
          ? existingConfig.user
          : null;
      const setupUserId = "userId" in configInput && configInput.userId ? configInput.userId : null;
      const userId = setupUserId ?? migratedUser?.data.userId ?? null;

      if (userId) {
        const updatesResponse = await sendUpdatesToBackend({
          appUrl: configInput.appUrl,
          workspaceId: effectiveId,
          updates: {
            userId,
            // Attributes only ever come from the setup call, never from the migrated state.
            ...(setupUserId && "attributes" in configInput ? { attributes: configInput.attributes } : {}),
          },
        });

        if (updatesResponse.ok) {
          userState = updatesResponse.data.state;
        } else {
          logger.error(
            `Error updating user state: ${updatesResponse.error.code} - ${updatesResponse.error.responseMessage ?? ""}`
          );

          // The migration is one-shot: the config just written no longer looks legacy, so `changed`
          // is false on every later load and this id is gone for good if it is not kept now. Keep
          // the migrated state, expired, so the next load retries the sync instead of persisting
          // the default and stranding the user as anonymous.
          if (!setupUserId && migratedUser) {
            userState = { ...migratedUser, expiresAt: new Date(0) };
          }
        }
      }

      const workspace = workspaceResponse.data;
      logger.debug(`Fetched ${workspace.data.surveys.length.toString()} surveys from the backend`);
      const filteredSurveys = filterSurveys(workspace, userState);

      config.update({
        appUrl: configInput.appUrl,
        workspaceId: effectiveId,
        user: userState,
        workspace,
        filteredSurveys,
      });

      const surveyIds = filteredSurveys.map((s) => s.id);
      logger.debug(
        `${surveyIds.length.toString()} surveys could be shown to current user on trigger: ${surveyIds.join(", ")}`
      );
    } catch (e) {
      await handleErrorOnFirstSetup(e as { code: string; responseMessage: string });
    }
  }

  logger.debug("Adding event listeners");
  addEventListeners();
  addCleanupEventListeners();

  // Mount the status live region now so assistive tech has registered it long before the
  // first survey announces its opening into it.
  addLiveRegionContainer();

  // Prefetch surveys script so it's warm in the cache when a survey triggers
  prefetchSurveysScript(configInput.appUrl);

  setIsSetup(true);
  logger.debug("Set up complete");

  return okVoid();
};

export const tearDown = (): void => {
  const logger = Logger.getInstance();
  const appConfig = Config.getInstance();

  const { workspace } = appConfig.get();
  const filteredSurveys = filterSurveys(workspace, DEFAULT_USER_STATE_NO_USER_ID);

  logger.debug("Setting user state to default");

  // clear the user state and set it to the default value
  appConfig.update({
    ...appConfig.get(),
    user: DEFAULT_USER_STATE_NO_USER_ID,
    filteredSurveys,
  });

  closeSurvey();
};

export const handleErrorOnFirstSetup = (e: { code: string; responseMessage: string }): Promise<never> => {
  const logger = Logger.getInstance();

  if (e.code === "forbidden") {
    logger.error(`Authorization error: ${e.responseMessage}`);
  } else {
    logger.error(`Error during first setup: ${e.code} - ${e.responseMessage}. Please try again later.`);
  }

  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TConfig> = {
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  };

  wrapThrows(() => {
    localStorage.setItem(JS_LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig));
  })();

  throw new Error("Could not set up formbricks");
};

export const putFormbricksInErrorState = (formbricksConfig: Config): void => {
  const logger = Logger.getInstance();

  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  formbricksConfig.update({
    ...formbricksConfig.get(),
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  });

  tearDown();
};
