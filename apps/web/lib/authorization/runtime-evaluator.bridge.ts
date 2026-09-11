import "server-only";
import { legacyEvaluator } from "./legacy-evaluator";

/**
 * The immutable v5-to-v6 bridge runtime. This module is selected only while compiling the supported
 * bridge image; changing a container environment variable after the image is built cannot enable it.
 */
export const runtimeAuthorizationEvaluator = legacyEvaluator;
