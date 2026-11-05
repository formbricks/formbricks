/**
 * Where the visitor's share-of-visitors rolls live in the browser: `localStorage`, as JSON
 * `{ [creativeId]: roll }` with each roll in [0, 100). Never sent anywhere.
 *
 * A roll, not a yes/no, is kept: raising a creative's share from 50 % to 80 % keeps everyone who already
 * saw it, and lowering it hides it only from those above the new line.
 */
export const CREATIVE_SHARE_STORAGE_KEY = "formbricks-creative-share";

/** Enough for every creative a workspace runs; the oldest rolls go first beyond it. */
const MAX_STORED_ROLLS = 200;

type TShareStorage = Pick<Storage, "getItem" | "setItem">;

const isRoll = (value: unknown): value is number => typeof value === "number" && value >= 0 && value < 100;

const readRolls = (storage: TShareStorage | null): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CREATIVE_SHARE_STORAGE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([, roll]) => isRoll(roll)));
    }
  } catch {
    // Blocked or unreadable storage: roll again, and keep the rolls for this page only.
  }
  return {};
};

/**
 * The visitor's roll for each creative: decided the first time it is asked for, then kept on every page.
 * Storage that is blocked or full still gives one answer per creative for the rest of the page.
 */
export const createShareRolls = (
  storage: TShareStorage | null,
  random: () => number = Math.random
): ((creativeId: string) => number) => {
  let rolls: Record<string, number> | null = null;

  return (creativeId) => {
    rolls ??= readRolls(storage);
    if (Object.hasOwn(rolls, creativeId)) return rolls[creativeId];

    const roll = random() * 100;
    rolls[creativeId] = roll;
    try {
      storage?.setItem(
        CREATIVE_SHARE_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(Object.entries(rolls).slice(-MAX_STORED_ROLLS)))
      );
    } catch {
      // Kept in memory for this page.
    }
    return roll;
  };
};
