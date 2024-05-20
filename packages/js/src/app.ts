import { TFormbricksApp } from "@formbricks/js-core/app";
import { TFormbricksWebsite } from "@formbricks/js-core/website";

import { loadFormbricksToProxy } from "./shared/loadFormbricks";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite;
  }
}

const formbricksProxyHandler: ProxyHandler<TFormbricksApp> = {
  get(_target, prop, _receiver) {
    return (...args: any[]) => loadFormbricksToProxy(prop as string, "app", ...args);
  },
};

const formbricksApp: TFormbricksApp = new Proxy({} as TFormbricksApp, formbricksProxyHandler);
export default formbricksApp;
