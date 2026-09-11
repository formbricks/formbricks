import "server-only";
import {
  getAuthzedAuthorizationContractDigest,
  getAuthzedClientConfigDigest,
  getCanonicalAuthzedSchemaDigest,
} from "./activation-contract";
import { getAuthzedActivationReceipt, getAuthzedActivationStatus } from "./activation-repository";
import { AUTHZED_ACTIVATION_PROTOCOL_VERSION } from "./activation-types";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { createAuthzedReleaseManifestDigest, readAuthzedReleaseManifest } from "./release-manifest";

export type TAuthzedRuntimeActivationResult = Readonly<{
  authority: "legacy" | "spicedb";
  status: "ready";
}>;

const notReady = (operation: string): AuthzedError =>
  new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED,
    operation,
    retryable: false,
  });

type TAuthzedRuntimeWaitOptions = Readonly<{
  intervalMs: number;
  timeoutMs: number;
}>;

type TAuthzedRuntimeWaitDependencies = Readonly<{
  check: typeof checkAuthzedRuntimeActivation;
  now: () => number;
  sleep: (durationMs: number) => Promise<void>;
}>;

/** One database-backed startup invariant. This deliberately performs no SpiceDB RPC. */
export const checkAuthzedRuntimeActivation = async (): Promise<TAuthzedRuntimeActivationResult> => {
  const manifest = await readAuthzedReleaseManifest();
  const status = await getAuthzedActivationStatus();

  if (manifest.authorizationMode === "legacy_bridge") {
    if (status.authority === "legacy") return { authority: "legacy", status: "ready" };
    if (status.authority !== "spicedb" || status.transition !== "rolling_back" || !status.activeReceiptId) {
      throw notReady("activation_runtime_bridge_state");
    }

    const [receipt, contractDigest, schemaDigest] = await Promise.all([
      getAuthzedActivationReceipt(status.activeReceiptId),
      Promise.resolve(getAuthzedAuthorizationContractDigest()),
      getCanonicalAuthzedSchemaDigest(),
    ]);
    if (
      receipt.kind !== "upgrade" ||
      receipt.status !== "active" ||
      receipt.generation !== status.generation ||
      receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      receipt.bridgeManifestDigest !== createAuthzedReleaseManifestDigest(manifest) ||
      receipt.contractDigest !== contractDigest ||
      receipt.schemaDigest !== schemaDigest ||
      receipt.clientConfigDigest !== getAuthzedClientConfigDigest()
    ) {
      throw notReady("activation_runtime_bridge_receipt");
    }

    return { authority: "legacy", status: "ready" };
  }

  if (
    status.authority !== "spicedb" ||
    (status.transition !== "activating" && status.transition !== "idle") ||
    !status.activeReceiptId
  ) {
    throw notReady("activation_runtime_authority");
  }

  const [receipt, contractDigest, schemaDigest] = await Promise.all([
    getAuthzedActivationReceipt(status.activeReceiptId),
    Promise.resolve(getAuthzedAuthorizationContractDigest()),
    getCanonicalAuthzedSchemaDigest(),
  ]);
  if (
    receipt.status !== "active" ||
    receipt.generation !== status.generation ||
    receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
    (status.transition === "activating" &&
      (receipt.kind !== "upgrade" ||
        receipt.candidateManifestDigest !== createAuthzedReleaseManifestDigest(manifest))) ||
    receipt.contractDigest !== contractDigest ||
    receipt.schemaDigest !== schemaDigest ||
    receipt.clientConfigDigest !== getAuthzedClientConfigDigest()
  ) {
    throw notReady("activation_runtime_receipt");
  }

  return { authority: "spicedb", status: "ready" };
};

const defaultWaitDependencies: TAuthzedRuntimeWaitDependencies = {
  check: checkAuthzedRuntimeActivation,
  now: () => performance.now(),
  sleep: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
};

/** Wait for the database-backed activation invariant without contacting SpiceDB. */
export const waitForAuthzedRuntimeActivation = async (
  options: TAuthzedRuntimeWaitOptions,
  dependencyOverrides: Partial<TAuthzedRuntimeWaitDependencies> = {}
): Promise<TAuthzedRuntimeActivationResult> => {
  const dependencies = { ...defaultWaitDependencies, ...dependencyOverrides };
  const deadline = dependencies.now() + options.timeoutMs;

  while (true) {
    try {
      return await dependencies.check();
    } catch {
      const remainingMs = deadline - dependencies.now();
      if (remainingMs <= 0) throw notReady("activation_runtime_wait_timeout");
      await dependencies.sleep(Math.min(options.intervalMs, remainingMs));
    }
  }
};
