// The script-tag bundle loaded on customer sites. The Zod config has to run before any module that
// builds a schema is evaluated, so it is the first module request here and `index` the second; ES
// modules evaluate in that order. The ESM build used by apps/web keeps its own Zod config.
import "./lib/zod-jitless";

export * from "./index";
