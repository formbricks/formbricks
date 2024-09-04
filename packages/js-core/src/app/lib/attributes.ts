import { FormbricksAPI } from "@formbricks/api";
import { TAttributes } from "@formbricks/types/attributes";
import { MissingPersonError, NetworkError, Result, err, ok, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { fetchPersonState } from "../../shared/personState";
import { filterSurveys } from "../../shared/utils";
import { AppConfig } from "./config";

const appConfig = AppConfig.getInstance();
const logger = Logger.getInstance();

export const updateAttribute = async (
  key: string,
  value: string | number
): Promise<
  Result<
    {
      changed: boolean;
      message: string;
    },
    Error | NetworkError
  >
> => {
  const { apiHost, environmentId } = appConfig.get();
  const userId = appConfig.get().personState.data.userId;

  if (!userId) {
    return err({
      code: "network_error",
      status: 500,
      message: "Missing userId",
      url: `${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`,
      responseMessage: "Missing userId",
    });
  }

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: { [key]: value } });

  if (!res.ok) {
    // @ts-expect-error
    if (res.error.details?.ignore) {
      logger.error(res.error.message ?? `Error updating person with userId ${userId}`);
      return {
        ok: true,
        value: {
          changed: false,
          message: res.error.message,
        },
      };
    }
    return err({
      code: "network_error",
      // @ts-expect-error
      status: res.error.status ?? 500,
      message: res.error.message ?? `Error updating person with userId ${userId}`,
      url: `${appConfig.get().apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`,
      responseMessage: res.error.message,
    });
  }

  if (res.data.changed) {
    logger.debug("Attribute updated in Formbricks");
    return {
      ok: true,
      value: {
        changed: true,
        message: "Attribute updated in Formbricks",
      },
    };
  }

  return {
    ok: true,
    value: {
      changed: false,
      message: "Attribute not updated in Formbricks",
    },
  };
};

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes
): Promise<Result<TAttributes, NetworkError>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  try {
    const existingAttributes = appConfig.get().personState.data.attributes;
    if (existingAttributes) {
      for (const [key, value] of Object.entries(existingAttributes)) {
        if (updatedAttributes[key] === value) {
          delete updatedAttributes[key];
        }
      }
    }
  } catch (e) {
    logger.debug("config not set; sending all attributes to backend");
  }

  // send to backend if updatedAttributes is not empty
  if (Object.keys(updatedAttributes).length === 0) {
    logger.debug("No attributes to update. Skipping update.");
    return ok(updatedAttributes);
  }

  logger.debug("Updating attributes: " + JSON.stringify(updatedAttributes));

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: updatedAttributes });

  if (res.ok) {
    return ok(updatedAttributes);
  } else {
    // @ts-expect-error
    if (res.error.details?.ignore) {
      logger.error(res.error.message ?? `Error updating person with userId ${userId}`);
      return ok(updatedAttributes);
    }

    return err({
      code: "network_error",
      status: 500,
      message: `Error updating person with userId ${userId}`,
      url: `${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`,
      responseMessage: res.error.message,
    });
  }
};

export const isExistingAttribute = (key: string, value: string): boolean => {
  if (appConfig.get().personState.data.attributes[key] === value) {
    return true;
  }

  return false;
};

export const setAttributeInApp = async (
  key: string,
  value: any
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  if (key === "userId") {
    logger.error("Setting userId is no longer supported. Please set the userId in the init call instead.");
    return okVoid();
  }

  const userId = appConfig.get().personState.data.userId;

  if (!userId) {
    return err({
      code: "missing_person",
      message: "Missing userId",
    });
  }

  logger.debug("Setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (isExistingAttribute(key, value.toString())) {
    logger.debug("Attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updateAttribute(key, value.toString());

  if (result.ok) {
    if (result.value.changed) {
      const personState = await fetchPersonState(
        {
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
          userId,
        },
        true
      );

      const filteredSurveys = filterSurveys(appConfig.get().environmentState, personState);

      appConfig.update({
        ...appConfig.get(),
        personState,
        filteredSurveys,
      });
    }

    return okVoid();
  }

  return err(result.error as NetworkError);
};
