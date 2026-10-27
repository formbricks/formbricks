import { type TApiResponse } from "./api-client.ts";

// The UMD wrapper assigns the SDK to `<global>.formbricks`. A proxy fallback or login page never contains it.
const SDK_GLOBAL_ASSIGNMENT = /\.formbricks\s*=/;

/** Why the response is not the JavaScript SDK bundle, or `undefined` when it is. */
export const describeSdkBundleProblem = (response: TApiResponse): string | undefined => {
  if (response.status !== 200) return `returned HTTP ${response.status}`;
  if (response.text.trimStart().startsWith("<")) return "returned an HTML page instead of JavaScript";
  if (!SDK_GLOBAL_ASSIGNMENT.test(response.text)) {
    return `returned ${response.text.length} bytes that are not the Formbricks SDK`;
  }
  return undefined;
};
