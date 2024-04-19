import structuredClonePolyfill from "@ungap/structured-clone";

let structuredCloneExport: typeof structuredClonePolyfill;

if (typeof structuredClone === "undefined") {
  structuredCloneExport = structuredClonePolyfill;
} else {
  // @ts-expect-error
  structuredCloneExport = structuredClone;
}

export { structuredCloneExport as structuredClone };
