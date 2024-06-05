import { TFormbricksApp } from "@formbricks/js-core/dist/app";
import { TFormbricksWebsite } from "@formbricks/js-core/dist/website";

import { loadFormbricksToProxy } from "./shared/loadFormbricks";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite;
  }
}

const formbricksProxyHandler: ProxyHandler<TFormbricksWebsite> = {
  get(_target, prop, _receiver) {
    return (...args: any[]) => loadFormbricksToProxy(prop as string, "website", ...args);
  },
};

const formbricksWebsite: TFormbricksWebsite = new Proxy({} as TFormbricksWebsite, formbricksProxyHandler);
export default formbricksWebsite;
