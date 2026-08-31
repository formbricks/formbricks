import "server-only";

export type TAuthzedUpgradeCliCommand =
  | Readonly<{ action: "check" }>
  | Readonly<{ action: "prepare"; expectedCurrentDigest?: string }>;

const SCHEMA_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

/** Parse upgrade arguments before loading application configuration or constructing a client. */
export const parseAuthzedUpgradeCliCommand = (
  args: ReadonlyArray<string>
): TAuthzedUpgradeCliCommand | undefined => {
  if (args.length === 1 && args[0] === "check") {
    return { action: "check" };
  }

  if (args[0] !== "prepare") {
    return undefined;
  }

  if (args.length === 1) {
    return { action: "prepare" };
  }

  if (
    args.length === 3 &&
    args[1] === "--expected-current-digest" &&
    SCHEMA_DIGEST_PATTERN.test(args[2] ?? "")
  ) {
    return { action: "prepare", expectedCurrentDigest: args[2] };
  }

  return undefined;
};
