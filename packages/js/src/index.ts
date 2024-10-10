 
import { type TFormbricksApp } from "@formbricks/js-core";
import { loadFormbricksToProxy } from "./lib/load-formbricks";

declare global {
  interface Window {
    formbricks: TFormbricksApp | undefined;
  }
}

const formbricksProxyHandler: ProxyHandler<TFormbricksApp> = {
  get(_target, prop, _receiver) {
    return (...args: unknown[]) => loadFormbricksToProxy(prop as string, ...args);
  },
};

const formbricksApp: TFormbricksApp = new Proxy({} as TFormbricksApp, formbricksProxyHandler);

// eslint-disable-next-line import/no-default-export -- Required for UMD
export default formbricksApp;
