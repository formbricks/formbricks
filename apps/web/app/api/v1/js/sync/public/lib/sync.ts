import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentIdCached } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TJsState } from "@formbricks/types/js";

export const getPublicUpdatedState = async (environmentId: string) => {
  // check if environment exists
  const environment = await getEnvironment(environmentId);

  if (!environment) {
    throw new Error("Environment does not exist");
  }

  // TODO: check if Monthly Active Users limit is reached

  const [surveys, noCodeActionClasses, product] = await Promise.all([
    getSurveys(environmentId),
    getActionClasses(environmentId),
    getProductByEnvironmentIdCached(environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  const state: TJsState = {
    surveys,
    noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
    product,
    person: null,
    session: null,
  };

  return state;
};
