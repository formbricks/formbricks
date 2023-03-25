import { h, render } from "preact";
import App from "../App";
import Config from "./config";
import { getSettings } from "./settings";

const containerId = "formbricks-web-container";
const config = Config.get();

export const renderWidget = (survey) => {
  render(
    h(App, { config, survey, closeSurvey, brandColor: config.settings?.brandColor }),
    document.getElementById(containerId)
  );
};

export const closeSurvey = async () => {
  // remove container element from DOM
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const settings = await getSettings();
  Config.update({ settings });
};
