import "server-only";
import { type TAuthzedDigest, isAuthzedDigest, isAuthzedReceiptId } from "./activation-types";

export type TAuthzedActivationCliCommand =
  | Readonly<{ action: "abort"; receiptId: string }>
  | Readonly<{ action: "activate"; receiptId: string }>
  | Readonly<{ action: "bootstrap" }>
  | Readonly<{ action: "bootstrap_development" }>
  | Readonly<{ action: "finalize"; receiptId: string }>
  | Readonly<{
      action: "prepare";
      bridgeImageDigest: TAuthzedDigest;
      bridgeManifestDigest: TAuthzedDigest;
      candidateImageDigest: TAuthzedDigest;
      candidateManifestDigest: TAuthzedDigest;
      expectedCurrentDigest?: TAuthzedDigest;
    }>
  | Readonly<{ action: "rollback_begin"; receiptId: string }>
  | Readonly<{ action: "rollback_complete"; receiptId: string }>
  | Readonly<{ action: "runtime_check" }>
  | Readonly<{ action: "runtime_wait"; intervalMs: number; timeoutMs: number }>
  | Readonly<{ action: "status" }>;

const DEFAULT_RUNTIME_WAIT_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_RUNTIME_WAIT_INTERVAL_MS = 5_000;
const MAX_RUNTIME_WAIT_TIMEOUT_SECONDS = 3_600;
const MAX_RUNTIME_WAIT_INTERVAL_SECONDS = 60;

const parseBoundedSeconds = (value: string | undefined, maximum: number): number | undefined => {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds > maximum) return undefined;
  return seconds * 1_000;
};

const parseFlags = (args: ReadonlyArray<string>): ReadonlyMap<string, string> | undefined => {
  if (args.length % 2 !== 0) return undefined;
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value || flags.has(name)) return undefined;
    flags.set(name, value);
  }
  return flags;
};

const parseReceiptCommand = (
  action: "abort" | "activate" | "finalize" | "rollback_begin" | "rollback_complete",
  args: ReadonlyArray<string>
): TAuthzedActivationCliCommand | undefined => {
  const flags = parseFlags(args);
  const receiptId = flags?.get("--receipt");
  if (flags?.size !== 1 || !receiptId || !isAuthzedReceiptId(receiptId)) return undefined;
  return { action, receiptId };
};

export const parseAuthzedActivationCliCommand = (
  args: ReadonlyArray<string>
): TAuthzedActivationCliCommand | undefined => {
  const [action, ...rest] = args;
  if ((action === "status" || action === "runtime-check") && rest.length === 0) {
    return { action: action === "runtime-check" ? "runtime_check" : "status" };
  }
  if (action === "runtime-wait") {
    if (rest.length === 0) {
      return {
        action: "runtime_wait",
        intervalMs: DEFAULT_RUNTIME_WAIT_INTERVAL_MS,
        timeoutMs: DEFAULT_RUNTIME_WAIT_TIMEOUT_MS,
      };
    }
    const runtimeWaitFlags = parseFlags(rest);
    if (runtimeWaitFlags?.size !== 2) return undefined;
    const timeoutMs = parseBoundedSeconds(
      runtimeWaitFlags.get("--timeout-seconds"),
      MAX_RUNTIME_WAIT_TIMEOUT_SECONDS
    );
    const intervalMs = parseBoundedSeconds(
      runtimeWaitFlags.get("--interval-seconds"),
      MAX_RUNTIME_WAIT_INTERVAL_SECONDS
    );
    if (!timeoutMs || !intervalMs || intervalMs > timeoutMs) return undefined;
    return { action: "runtime_wait", intervalMs, timeoutMs };
  }
  if (
    action === "abort" ||
    action === "activate" ||
    action === "finalize" ||
    action === "rollback-begin" ||
    action === "rollback-complete"
  ) {
    const receiptAction = {
      abort: "abort",
      activate: "activate",
      finalize: "finalize",
      "rollback-begin": "rollback_begin",
      "rollback-complete": "rollback_complete",
    } as const;
    return parseReceiptCommand(receiptAction[action], rest);
  }

  if (action === "bootstrap" && rest.length === 0) return { action: "bootstrap" };
  if (action === "bootstrap-development" && rest.length === 0) {
    return { action: "bootstrap_development" };
  }

  const flags = parseFlags(rest);
  if (!flags) return undefined;
  if (action !== "prepare") return undefined;

  const bridgeImageDigest = flags.get("--bridge-image-digest");
  const bridgeManifestDigest = flags.get("--bridge-manifest-digest");
  const candidateImageDigest = flags.get("--candidate-image-digest");
  const candidateManifestDigest = flags.get("--candidate-manifest-digest");
  const expectedCurrentDigest = flags.get("--expected-current-digest");
  const expectedSize = expectedCurrentDigest ? 5 : 4;
  if (
    flags.size !== expectedSize ||
    !bridgeImageDigest ||
    !isAuthzedDigest(bridgeImageDigest) ||
    !bridgeManifestDigest ||
    !isAuthzedDigest(bridgeManifestDigest) ||
    !candidateImageDigest ||
    !isAuthzedDigest(candidateImageDigest) ||
    !candidateManifestDigest ||
    !isAuthzedDigest(candidateManifestDigest) ||
    (expectedCurrentDigest !== undefined && !isAuthzedDigest(expectedCurrentDigest))
  ) {
    return undefined;
  }
  return {
    action: "prepare",
    bridgeImageDigest,
    bridgeManifestDigest,
    candidateImageDigest,
    candidateManifestDigest,
    ...(expectedCurrentDigest ? { expectedCurrentDigest } : {}),
  };
};
