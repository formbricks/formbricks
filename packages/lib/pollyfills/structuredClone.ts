import structuredClonePolyfill from "@ungap/structured-clone";

let structuredCloneExport = structuredClone;

if (typeof structuredCloneExport === "undefined") {
  // @ts-expect-error
  structuredCloneExport = structuredClonePolyfill;
}

// export default structuredCloneExport;
export { structuredCloneExport as structuredClone };
