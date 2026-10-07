import {
  assertAuthRuntimeConfiguration,
  assertAuthzedRuntimeConfiguration,
  warnOnAuthSecretRisks,
} from "../../lib/env";

// Migrations reuse basic environment validation without client credentials.
// Only application startup opts into the stricter, configuration-only contract.
if (process.argv.includes("--server")) {
  assertAuthzedRuntimeConfiguration();
  assertAuthRuntimeConfiguration();
  warnOnAuthSecretRisks();
}

console.log("Environment variables validated successfully");
