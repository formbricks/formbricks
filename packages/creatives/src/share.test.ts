import { describe, expect, test } from "vitest";
import { CREATIVE_SHARE_STORAGE_KEY, createShareRolls } from "./share";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
};

const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("createShareRolls", () => {
  test("rolls a visitor once per creative and keeps the answer", () => {
    const getShareRoll = createShareRolls(memoryStorage(), sequence(0.25, 0.75));

    expect(getShareRoll("a")).toBe(25);
    expect(getShareRoll("a")).toBe(25);
    expect(getShareRoll("b")).toBe(75);
  });

  test("keeps the answer on the next page, from the browser's storage", () => {
    const storage = memoryStorage();
    createShareRolls(storage, () => 0.4)("a");

    const nextPage = createShareRolls(storage, () => 0.9);

    expect(nextPage("a")).toBe(40);
  });

  test("stores the rolls under its own key, as plain JSON", () => {
    const storage = memoryStorage();
    createShareRolls(storage, () => 0.5)("a");

    expect(JSON.parse(storage.items.get(CREATIVE_SHARE_STORAGE_KEY) ?? "null")).toEqual({ a: 50 });
  });

  test("still decides once per page when the browser blocks storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    const getShareRoll = createShareRolls(blocked, sequence(0.1, 0.9));

    expect(getShareRoll("a")).toBe(10);
    expect(getShareRoll("a")).toBe(10);
  });

  test("rolls again over a stored value it can't read", () => {
    const storage = memoryStorage({ [CREATIVE_SHARE_STORAGE_KEY]: '{"a":"high"' });

    expect(createShareRolls(storage, () => 0.3)("a")).toBe(30);
  });
});
