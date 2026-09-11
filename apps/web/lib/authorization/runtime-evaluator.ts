import "server-only";
import { spicedbEvaluator } from "./spicedb-evaluator";

/**
 * The normal v6 application runtime. The production build aliases the coordinator to this module,
 * so the emitted application bundle contains no legacy decision path.
 */
export const runtimeAuthorizationEvaluator = spicedbEvaluator;
