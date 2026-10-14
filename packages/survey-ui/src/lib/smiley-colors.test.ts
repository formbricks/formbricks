import { describe, expect, test } from "vitest";
import { type RatingRange, getSmileyColorClasses } from "./smiley-colors";

const INK = "dark:text-slate-900";

type Tone = "rose" | "orange" | "emerald";

/**
 * The color-coded tone of every face, per range. `Record<RatingRange, …>` makes this exhaustive:
 * a range added to the union has to be added here too.
 *
 * The same mapping is painted on the number scale by getRatingNumberOptionColor in rating.tsx (in
 * 1-based form), and all six rows agree with it — so this table pins both scales to each other.
 */
const TONES: Record<RatingRange, Tone[]> = {
  3: ["rose", "orange", "emerald"],
  4: ["rose", "rose", "orange", "emerald"],
  5: ["rose", "rose", "orange", "emerald", "emerald"],
  6: ["rose", "rose", "orange", "orange", "emerald", "emerald"],
  7: ["rose", "rose", "rose", "orange", "orange", "emerald", "emerald"],
  10: ["rose", "rose", "rose", "rose", "rose", "rose", "orange", "orange", "emerald", "emerald"],
};

// Derived from the table rather than written out again, so the ranges covered here cannot fall
// behind the union. (Object.keys is typed as string[]; the keys are RatingRange by construction.)
const RANGES = Object.keys(TONES).map(Number) as RatingRange[];

const faces = (range: RatingRange): number[] => Array.from({ length: range }, (_, idx) => idx);

describe("getSmileyColorClasses", () => {
  test("gives a face with a fill the dark ink, and lets an unfilled one keep inheriting", () => {
    for (const range of RANGES) {
      for (const idx of faces(range)) {
        // Without color coding, only the selected face is filled.
        expect(getSmileyColorClasses(range, idx, true, false)).toEqual({ fill: "fill-yellow-200", ink: INK });
        expect(getSmileyColorClasses(range, idx, false, false)).toEqual({ fill: "fill-none", ink: "" });

        // Color coding fills every face, selected or not, so every face carries the ink.
        for (const active of [true, false]) {
          const { fill, ink } = getSmileyColorClasses(range, idx, active, true);
          expect(fill).not.toBe("fill-none");
          expect(ink).toBe(INK);
        }
      }
    }
  });

  test("paints the color-coded scale rose → orange → emerald, light pastel until a face is active", () => {
    for (const range of RANGES) {
      const tones = TONES[range];
      expect(tones).toHaveLength(range);

      expect(faces(range).map((idx) => getSmileyColorClasses(range, idx, false, true).fill)).toEqual(
        tones.map((tone) => `fill-${tone}-100`)
      );
      expect(faces(range).map((idx) => getSmileyColorClasses(range, idx, true, true).fill)).toEqual(
        tones.map((tone) => `fill-${tone}-300`)
      );
    }
  });
});
