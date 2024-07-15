/* eslint-disable @typescript-eslint/no-unsafe-assignment --
 * Required because it doesn't work without building otherwise
 */
import { type TFormbricksApp } from "@formbricks/js-core/app";
import { type TFormbricksWebsite } from "@formbricks/js-core/website";
import { loadFormbricksToProxy } from "./shared/load-formbricks";

declare global {
  interface Window {
    formbricks: TFormbricksApp | TFormbricksWebsite | undefined;
  }
}

const formbricksProxyHandler: ProxyHandler<TFormbricksWebsite> = {
  get(_target, prop, _receiver) {
    return (...args: unknown[]) => loadFormbricksToProxy(prop as string, "website", ...args);
  },
};

const formbricksWebsite: TFormbricksWebsite = new Proxy({} as TFormbricksWebsite, formbricksProxyHandler);

// eslint-disable-next-line import/no-default-export -- Required for UMD
export default formbricksWebsite;
