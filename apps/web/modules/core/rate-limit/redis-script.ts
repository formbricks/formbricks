import type { RedisClientType } from "redis";

type Script = Readonly<{ SCRIPT: string | Buffer; SHA1: string }>;

/** Keep the EVALSHA miss and its EVAL fallback inside the caller's one Redis deadline. */
export const runRateLimitScript = async (
  redis: RedisClientType,
  script: Script,
  keys: string[],
  args: string[]
): Promise<unknown> => {
  const options = { keys, arguments: args };
  try {
    return await redis.evalSha(script.SHA1, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("NOSCRIPT")) throw error;
    return redis.eval(script.SCRIPT, options);
  }
};
