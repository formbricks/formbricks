import { FormbricksAPI } from "@formbricks/api";
import { TSurvey } from "@formbricks/types/surveys";

import { Config } from "./config";

const config = Config.getInstance();

export const createDisplay = async (survey: TSurvey) => {
  const { userId } = config.get();

  const api = new FormbricksAPI({
    apiHost: config.get().apiHost,
    environmentId: config.get().environmentId,
  });
  const res = await api.client.display.create({
    surveyId: survey.id,
    userId,
  });
  if (!res.ok) {
    throw new Error("Could not create display");
  }
  return res.data;
};
