import { createClient } from "redis";

/**
 * Measures what a request leaves in Redis: the value bytes of every key it created. For tests that bound
 * what an anonymous or low-privilege caller can park there (ENG-6885, ENG-7396). Integration files run one
 * at a time (`fileParallelism: false`), so no other test writes keys while a request is measured.
 *
 * It sees new keys only: key-name bytes, and a write that overwrites or grows a key that already existed,
 * read as 0. That fits records keyed by a fresh random id (OAuth state, authorization codes); a test of
 * anything else needs another measure.
 */
export const createRedisBytesWritten = () => {
  const inspector = createClient({ url: process.env.REDIS_URL });

  return {
    connect: async () => {
      await inspector.connect();
    },
    quit: async () => {
      await inspector.quit();
    },
    /** `run`'s result, and the bytes of every Redis value written while it was in flight. */
    measure: async <T>(run: () => Promise<T>): Promise<{ result: T; storedBytes: number }> => {
      const before = new Set(await inspector.keys("*"));
      const result = await run();
      const created = (await inspector.keys("*")).filter((key) => !before.has(key));
      const sizes = await Promise.all(created.map((key) => inspector.strLen(key)));
      return { result, storedBytes: sizes.reduce((sum, size) => sum + size, 0) };
    },
  };
};
