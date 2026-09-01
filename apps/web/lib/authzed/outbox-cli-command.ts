import "server-only";

export type TAuthzedOutboxCliCommand =
  | Readonly<{ action: "drain"; maxBatches: number }>
  | Readonly<{ action: "replay" }>
  | Readonly<{ action: "status" }>;

const MAX_BATCHES = 1_000;

export const parseAuthzedOutboxCliCommand = (
  args: ReadonlyArray<string>
): TAuthzedOutboxCliCommand | undefined => {
  const [action, ...flags] = args;
  if (action === "status" || action === "replay") {
    return flags.length === 0 ? { action } : undefined;
  }
  if (action !== "drain") return undefined;
  if (flags.length === 0) return { action, maxBatches: 100 };
  if (flags.length !== 1 || !flags[0].startsWith("--max-batches=")) return undefined;

  const value = flags[0].slice("--max-batches=".length);
  if (!/^[1-9]\d{0,3}$/.test(value)) return undefined;
  const maxBatches = Number(value);
  return maxBatches <= MAX_BATCHES ? { action, maxBatches } : undefined;
};
