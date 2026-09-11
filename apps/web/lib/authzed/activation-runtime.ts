import "server-only";
import {
  getAuthzedAuthorizationContractDigest,
  getAuthzedClientConfigDigest,
  getCanonicalAuthzedSchemaDigest,
} from "./activation-contract";
import { getAuthzedActivationReceipt, getAuthzedActivationStatus } from "./activation-repository";
import { AUTHZED_ACTIVATION_PROTOCOL_VERSION } from "./activation-types";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { createAuthzedReleaseManifestDigest, readAuthzedReleaseManifest } from "./release-manifest";

export type TAuthzedRuntimeActivationResult = Readonly<{
  authority: "legacy" | "spicedb";
  status: "ready";
}>;

const notReady = (operation: string, retryable = false): AuthzedError =>
  new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED,
    operation,
    retryable,
  });

const deterministicRuntimeFailure = (operation: string, cause: unknown): AuthzedError =>
  new AuthzedError({
    attempts: 0,
    cause,
    code: AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED,
    operation,
    retryable: false,
  });

const shouldWaitForRuntimeActivation = (error: unknown): boolean =>
  !(error instanceof AuthzedError) || error.retryable;

const getRuntimeContractDigests = async (): Promise<
  readonly [contractDigest: string, schemaDigest: string, clientConfigDigest: string]
> => {
  try {
    return await Promise.all([
      Promise.resolve(getAuthzedAuthorizationContractDigest()),
      getCanonicalAuthzedSchemaDigest(),
      Promise.resolve(getAuthzedClientConfigDigest()),
    ]);
  } catch (error) {
    throw deterministicRuntimeFailure("activation_runtime_contract", error);
  }
};

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
  if (manifest.authorizationMode === "spicedb_authoritative" && !isAuthzedEnabled()) {
    throw notReady("activation_runtime_authzed_disabled");
  }

  const status = await getAuthzedActivationStatus();

  if (manifest.authorizationMode === "legacy_bridge") {
    if (status.authority === "legacy") return { authority: "legacy", status: "ready" };
    if (status.authority !== "spicedb" || status.transition !== "rolling_back" || !status.activeReceiptId) {
      throw notReady("activation_runtime_bridge_state", true);
    }

    const receipt = await getAuthzedActivationReceipt(status.activeReceiptId);
    const [contractDigest, schemaDigest, clientConfigDigest] = await getRuntimeContractDigests();
    if (
      receipt.kind !== "upgrade" ||
      receipt.status !== "active" ||
      receipt.generation !== status.generation ||
      receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      receipt.bridgeManifestDigest !== createAuthzedReleaseManifestDigest(manifest) ||
      receipt.contractDigest !== contractDigest ||
      receipt.schemaDigest !== schemaDigest ||
      receipt.clientConfigDigest !== clientConfigDigest
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
    throw notReady("activation_runtime_authority", true);
  }

  const receipt = await getAuthzedActivationReceipt(status.activeReceiptId);
  const [contractDigest, schemaDigest, clientConfigDigest] = await getRuntimeContractDigests();
  // While the cutover fence is active, only the exact release candidate recorded by the bridge may
  // start. After finalization, patch releases may change their image manifest, but the durable receipt
  // continues to bind the authorization contract and canonical schema. A future release that changes
  // either digest needs an explicit fenced authoritative-to-authoritative refresh protocol; silently
  // admitting it could start new authorization code against an older SpiceDB graph.
  if (
    receipt.status !== "active" ||
    receipt.generation !== status.generation ||
    receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
    (status.transition === "activating" &&
      (receipt.kind !== "upgrade" ||
        receipt.candidateManifestDigest !== createAuthzedReleaseManifestDigest(manifest))) ||
    receipt.contractDigest !== contractDigest ||
    receipt.schemaDigest !== schemaDigest ||
    receipt.clientConfigDigest !== clientConfigDigest
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
    } catch (error) {
      if (!shouldWaitForRuntimeActivation(error)) throw error;
      const remainingMs = deadline - dependencies.now();
      if (remainingMs <= 0) throw notReady("activation_runtime_wait_timeout");
      await dependencies.sleep(Math.min(options.intervalMs, remainingMs));
    }
  }
};
