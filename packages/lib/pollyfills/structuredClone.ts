import structuredClonePolyfill from "@ungap/structured-clone";

let structuredCloneExport: typeof structuredClonePolyfill;

if (typeof structuredClone === "undefined") {
  structuredCloneExport = structuredClonePolyfill;
}

export { structuredCloneExport as structuredClone };
