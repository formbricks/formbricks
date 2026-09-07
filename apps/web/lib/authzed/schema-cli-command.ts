import "server-only";

export type TAuthzedSchemaCliCommand =
  | Readonly<{ action: "check" }>
  | Readonly<{ action: "apply"; expectedCurrentDigest?: string }>;

/** Parse schema CLI arguments without loading the AuthZed client or environment configuration. */
export const parseAuthzedSchemaCliCommand = (
  args: ReadonlyArray<string>
): TAuthzedSchemaCliCommand | undefined => {
  if (args.length === 1 && args[0] === "check") {
    return { action: "check" };
  }

  if (args[0] !== "apply") {
    return undefined;
  }

  if (args.length === 1) {
    return { action: "apply" };
  }

  if (
    args.length === 3 &&
    args[1] === "--expected-current-digest" &&
    /^sha256:[a-f0-9]{64}$/.test(args[2] ?? "")
  ) {
    return { action: "apply", expectedCurrentDigest: args[2] };
  }

  return undefined;
};
