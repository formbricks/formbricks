import structuredClonePolyfill from "@ungap/structured-clone";

const structuredCloneExport =
  typeof structuredClone === "undefined" ? structuredClonePolyfill : structuredClone;

export { structuredCloneExport as structuredClone };
