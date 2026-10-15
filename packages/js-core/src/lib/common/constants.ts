export const JS_LOCAL_STORAGE_KEY = "formbricks-js";
export const LEGACY_JS_WEBSITE_LOCAL_STORAGE_KEY = "formbricks-js-website";
export const LEGACY_JS_APP_LOCAL_STORAGE_KEY = "formbricks-js-app";
// sessionStorage: debug mode stays on for the rest of the tab once `?formbricksDebug=true` is seen.
export const DEBUG_SESSION_STORAGE_KEY = "formbricks-debug";
export const CONTAINER_ID = "formbricks-modal-container";
// Shipped id contract with the surveys renderer (packages/surveys/src/lib/live-region.ts) — old SDKs
// stay on the wire for years, so this value must never change.
export const LIVE_REGION_ID = "formbricks-live-region";
export const RECAPTCHA_SCRIPT_ID = "formbricks-recaptcha-script";
