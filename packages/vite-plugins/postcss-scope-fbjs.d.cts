// Hand-written declarations for postcss-scope-fbjs.cjs (kept as CJS so both the
// surveys and survey-ui PostCSS configs can require it without a build step).
import type { AcceptedPlugin } from "postcss";

interface ScopePluginCreator {
  (): AcceptedPlugin;
  postcss: true;
}

declare const scopeFbjs: {
  stripLayerProperties: ScopePluginCreator;
  scopeLayerTheme: ScopePluginCreator;
  replaceAtPropertyWithScoped: ScopePluginCreator;
  scopeFbjsPlugins: () => AcceptedPlugin[];
};

export = scopeFbjs;
