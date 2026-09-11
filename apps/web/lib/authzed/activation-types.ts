import "server-only";

export const AUTHZED_ACTIVATION_PROTOCOL_VERSION = 1;
export const AUTHZED_ACTIVATION_CONTROL_ID = "formbricks";
export const AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS = 10 * 60_000;
export const AUTHZED_ACTIVATION_FINALIZATION_SETTLEMENT_GRACE_MS = 5 * 60_000;
export const AUTHZED_ACTIVATION_PREPARATION_LEASE_RENEWAL_MS = 60_000;

export type TAuthzedAuthorizationAuthority = "legacy" | "spicedb";
export type TAuthzedAuthorizationTransition =
  | "idle"
  | "preparing"
  | "prepared"
  | "activating"
  | "rollback_fencing"
  | "rolling_back";
export type TAuthzedActivationReceiptStatus = "prepared" | "active" | "rolled_back" | "invalidated";
export type TAuthzedActivationKind = "fresh_install" | "upgrade";
export type TAuthzedUpgradeRunStatus = "pending" | "running" | "completed" | "failed";
export type TAuthzedDigest = `sha256:${string}`;

export type TAuthzedActivationEvidence = Readonly<{
  auditCounters: Readonly<Record<string, number>>;
  completedAtSnapshot: string | null;
  outboxCounters: Readonly<Record<string, number | null>>;
  sourceSequenceWatermark: bigint;
}>;

type TAuthzedActivationReceiptCommon = TAuthzedActivationEvidence &
  Readonly<{
    candidateManifestDigest: TAuthzedDigest;
    clientConfigDigest: TAuthzedDigest;
    contractDigest: TAuthzedDigest;
    schemaDigest: TAuthzedDigest;
  }>;

export type TAuthzedActivationReceiptInput =
  | (TAuthzedActivationReceiptCommon &
      Readonly<{
        bridgeImageDigest: null;
        bridgeManifestDigest: null;
        candidateImageDigest: null;
        kind: "fresh_install";
      }>)
  | (TAuthzedActivationReceiptCommon &
      Readonly<{
        bridgeImageDigest: TAuthzedDigest;
        bridgeManifestDigest: TAuthzedDigest;
        candidateImageDigest: TAuthzedDigest;
        kind: "upgrade";
      }>);

export type TAuthzedActivationStatus = Readonly<{
  activeReceiptId: string | null;
  authority: TAuthzedAuthorizationAuthority;
  fenceActive: boolean;
  generation: bigint;
  pendingReceiptId: string | null;
  transition: TAuthzedAuthorizationTransition;
}>;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RECEIPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isAuthzedDigest = (value: string): value is TAuthzedDigest => DIGEST_PATTERN.test(value);
export const isAuthzedReceiptId = (value: string): boolean => RECEIPT_ID_PATTERN.test(value);
