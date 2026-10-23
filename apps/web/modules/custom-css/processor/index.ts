/**
 * The custom CSS processor (ENG-2950): one server-side AST pipeline for preview, validation, every save
 * path and delivery-time reprocessing. Server-only — it loads lightningcss's native binary. Client code
 * that only needs change detection imports `./normalize` directly.
 */
export {
  BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES,
  CUSTOM_CSS_MAX_FUNCTION_DEPTH,
  CUSTOM_CSS_MAX_NESTING_DEPTH,
  CUSTOM_CSS_MAX_RULES,
  CUSTOM_CSS_MAX_SELECTOR_COMPOUNDS,
  CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH,
  CUSTOM_CSS_MAX_UNIVERSAL_COMPOUNDS,
  CUSTOM_CSS_MAX_WARNINGS,
  CUSTOM_CSS_PROCESSOR_VERSION,
  getCustomCssProcessorVersion,
} from "./constants";
export { normalizeCustomCssInput } from "./normalize";
export { processCustomCss, type TCustomCssProcessOptions, type TCustomCssProcessResult } from "./process";
