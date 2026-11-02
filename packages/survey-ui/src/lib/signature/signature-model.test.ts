import { describe, expect, test } from "vitest";
import {
  EMPTY_SIGNATURE,
  MIN_STROKE_LENGTH,
  type SignatureStroke,
  type SignatureValue,
  clearSignature,
  getSignatureLayout,
  getSignatureViewState,
  hasSignatureInput,
  isSignatureSigned,
  isSignificantStroke,
  isTypedNameSigned,
  nextSignatureMode,
  resolveSignatureContent,
  signatureFingerprint,
  strokeExtent,
  strokeLength,
  toNormalisedPoint,
} from "./signature-model";

const line = (length: number): SignatureStroke => [
  { x: 0.2, y: 0.5 },
  { x: 0.2 + length, y: 0.5 },
];
const value = (overrides: Partial<SignatureValue>): SignatureValue => ({ ...EMPTY_SIGNATURE, ...overrides });

describe("toNormalisedPoint", () => {
  const rect = { left: 100, top: 50, width: 300, height: 100 };

  test("maps a pointer position to 0-1 pad coordinates", () => {
    expect(toNormalisedPoint(250, 100, rect)).toEqual({ x: 0.5, y: 0.5 });
  });

  test("clamps a pointer that has slid off the pad", () => {
    expect(toNormalisedPoint(0, 1000, rect)).toEqual({ x: 0, y: 1 });
    expect(toNormalisedPoint(9999, -5, rect)).toEqual({ x: 1, y: 0 });
  });

  test("a pad with no size (hidden card) yields the origin, not NaN", () => {
    expect(toNormalisedPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("signed rule", () => {
  test("a bare tap (one point) is not signed", () => {
    expect(isSignatureSigned(value({ strokes: [[{ x: 0.5, y: 0.5 }]] }))).toBe(false);
  });

  test("a stroke shorter than the minimum length is not signed", () => {
    expect(isSignificantStroke(line(MIN_STROKE_LENGTH * 0.9))).toBe(false);
    expect(isSignatureSigned(value({ strokes: [line(MIN_STROKE_LENGTH * 0.9)] }))).toBe(false);
  });

  test("a stroke of the minimum length is signed", () => {
    expect(isSignatureSigned(value({ strokes: [line(MIN_STROKE_LENGTH)] }))).toBe(true);
  });

  test("one long stroke among tiny ones is enough", () => {
    expect(isSignatureSigned(value({ strokes: [[{ x: 0.1, y: 0.1 }], line(0.3)] }))).toBe(true);
  });

  test("many tiny strokes do not add up to a signature", () => {
    const dots = Array.from({ length: 20 }, () => line(MIN_STROKE_LENGTH / 2));
    expect(isSignatureSigned(value({ strokes: dots }))).toBe(false);
  });

  test("a vertical movement counts for what it measures on the 3:1 pad", () => {
    // 0.15 of the pad's height is 0.05 of its width.
    const vertical: SignatureStroke = [
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.35 },
    ];
    expect(strokeLength(vertical)).toBeCloseTo(0.05, 6);
    expect(isSignificantStroke(vertical)).toBe(true);
  });

  test("a finger trembling in place is not signed even though its path is long enough", () => {
    // 18 points alternating 0.002 apart: a path of 0.034, but the stroke never reaches further than 0.002.
    const jitter: SignatureStroke = Array.from({ length: 18 }, (_, i) => ({
      x: 0.5 + (i % 2) * 0.002,
      y: 0.5,
    }));
    expect(strokeLength(jitter)).toBeGreaterThanOrEqual(MIN_STROKE_LENGTH);
    expect(strokeExtent(jitter)).toBeLessThan(MIN_STROKE_LENGTH);
    expect(isSignificantStroke(jitter)).toBe(false);
    expect(isSignatureSigned(value({ strokes: [jitter] }))).toBe(false);
  });

  test("a short straight stroke below the minimum is not signed", () => {
    const short: SignatureStroke = [
      { x: 0.5, y: 0.5 },
      { x: 0.5 + MIN_STROKE_LENGTH * 0.9, y: 0.5 },
    ];
    expect(isSignificantStroke(short)).toBe(false);
  });

  test("a closed loop reaches far enough by its extent", () => {
    const loop: SignatureStroke = [
      { x: 0.3, y: 0.5 },
      { x: 0.4, y: 0.3 },
      { x: 0.5, y: 0.5 },
      { x: 0.4, y: 0.7 },
      { x: 0.3, y: 0.5 },
    ];
    expect(isSignificantStroke(loop)).toBe(true);
  });

  test("a name with no ink (zero-width or invisible characters only) is not signed", () => {
    for (const invisible of ["\u200B", "\u200B\u200B \u2060", "\uFEFF", "\u00AD", " \u200B "]) {
      expect(isTypedNameSigned(invisible)).toBe(false);
    }
    expect(isTypedNameSigned("...")).toBe(false);
    expect(isTypedNameSigned("\u200BAda")).toBe(true);
  });

  test("letters of any script, digits and symbols are ink", () => {
    for (const name of ["Ada", "李雷", "Мария", "٣", "X", "★", "©"])
      expect(isTypedNameSigned(name)).toBe(true);
  });

  test("a typed name is signed unless it is blank or whitespace", () => {
    expect(isTypedNameSigned("Ada Lovelace")).toBe(true);
    expect(isTypedNameSigned("")).toBe(false);
    expect(isTypedNameSigned("   \t ")).toBe(false);
    expect(isSignatureSigned(value({ mode: "type", typedName: "  " }))).toBe(false);
    expect(isSignatureSigned(value({ mode: "type", typedName: " Ada " }))).toBe(true);
  });

  test("the visible tab is the signature: a drawing counts in Draw, a name counts in Type", () => {
    expect(isSignatureSigned(value({ mode: "draw", strokes: [line(0.3)] }))).toBe(true);
    expect(isSignatureSigned(value({ mode: "type", typedName: "Ada" }))).toBe(true);
  });

  test("a typed name kept behind the Draw tab does not sign: Draw with no drawing is not signed", () => {
    expect(isSignatureSigned(value({ mode: "draw", typedName: "Ada" }))).toBe(false);
  });

  test("a drawing kept behind the Type tab does not sign: Type with an empty name is not signed", () => {
    expect(isSignatureSigned(value({ mode: "type", strokes: [line(0.3)], typedName: "" }))).toBe(false);
    expect(isSignatureSigned(value({ mode: "type", strokes: [line(0.3)], typedName: "   " }))).toBe(false);
  });

  test("switching back to a tab brings its kept input back as the signature", () => {
    const both = value({ mode: "draw", strokes: [line(0.3)], typedName: "Ada" });
    const onType = { ...both, mode: "type" as const };
    const backOnDraw = { ...onType, mode: "draw" as const };
    expect(isSignatureSigned(onType)).toBe(true);
    expect(isSignatureSigned(backOnDraw)).toBe(true);
    expect(backOnDraw.strokes).toBe(both.strokes);
    expect(backOnDraw.typedName).toBe("Ada");
  });
});

describe("hasSignatureInput", () => {
  test("is true when either tab holds anything, signed or not, and false once both are empty", () => {
    expect(hasSignatureInput(EMPTY_SIGNATURE)).toBe(false);
    expect(hasSignatureInput(value({ mode: "type", strokes: [line(0.3)] }))).toBe(true);
    expect(hasSignatureInput(value({ mode: "draw", typedName: " " }))).toBe(true);
    expect(hasSignatureInput(value({ strokes: [[{ x: 0.5, y: 0.5 }]] }))).toBe(true);
  });
});

describe("clearSignature", () => {
  test("drops both inputs and keeps the mode", () => {
    expect(clearSignature(value({ mode: "type", strokes: [line(0.3)], typedName: "Ada" }))).toEqual({
      mode: "type",
      strokes: [],
      typedName: "",
    });
  });
});

describe("resolveSignatureContent", () => {
  test("nothing signed resolves to null", () => {
    expect(resolveSignatureContent(EMPTY_SIGNATURE)).toBeNull();
    expect(resolveSignatureContent(value({ strokes: [[{ x: 0.5, y: 0.5 }]], typedName: " " }))).toBeNull();
  });

  test("the content is the active tab's, never the other one's", () => {
    const both = value({ strokes: [line(0.3)], typedName: "  Ada  " });
    expect(resolveSignatureContent({ ...both, mode: "draw" })).toEqual({
      kind: "strokes",
      strokes: both.strokes,
    });
    expect(resolveSignatureContent({ ...both, mode: "type" })).toEqual({ kind: "name", name: "Ada" });
  });

  test("an empty active tab resolves to null even when the other tab is signed (no hidden signature)", () => {
    expect(resolveSignatureContent(value({ mode: "type", strokes: [line(0.3)] }))).toBeNull();
    expect(resolveSignatureContent(value({ mode: "draw", typedName: "Ada" }))).toBeNull();
  });
});

describe("signatureFingerprint", () => {
  test("is null while unsigned", () => {
    expect(signatureFingerprint(EMPTY_SIGNATURE)).toBeNull();
  });

  test("is equal for values that export the same image", () => {
    const a = value({ strokes: [line(0.3)] });
    const b = value({ strokes: [line(0.3)], typedName: "left over" });
    expect(signatureFingerprint(a)).toBe(signatureFingerprint(b));
    expect(signatureFingerprint(value({ mode: "type", typedName: " Ada " }))).toBe(
      signatureFingerprint(value({ mode: "type", typedName: "Ada" }))
    );
  });

  test("is null for a value whose active tab is empty, however much the other tab holds", () => {
    expect(signatureFingerprint(value({ mode: "type", strokes: [line(0.3)] }))).toBeNull();
    expect(signatureFingerprint(value({ mode: "draw", typedName: "Ada" }))).toBeNull();
  });

  test("follows the active tab: the same two inputs fingerprint differently in each mode", () => {
    const both = value({ strokes: [line(0.3)], typedName: "Ada" });
    expect(signatureFingerprint({ ...both, mode: "draw" })).toMatch(/^strokes:/);
    expect(signatureFingerprint({ ...both, mode: "type" })).toBe("name:Ada");
  });

  test("changes when a stroke or the name changes", () => {
    expect(signatureFingerprint(value({ strokes: [line(0.3)] }))).not.toBe(
      signatureFingerprint(value({ strokes: [line(0.31)] }))
    );
    expect(signatureFingerprint(value({ strokes: [line(0.3), line(0.2)] }))).not.toBe(
      signatureFingerprint(value({ strokes: [line(0.3)] }))
    );
    expect(signatureFingerprint(value({ mode: "type", typedName: "Ada" }))).not.toBe(
      signatureFingerprint(value({ mode: "type", typedName: "Ada L" }))
    );
  });

  test("ignores a change in the other, unused input", () => {
    const drawn = value({ mode: "draw", strokes: [line(0.3)] });
    expect(signatureFingerprint({ ...drawn, typedName: "left over" })).toBe(signatureFingerprint(drawn));
  });
});

describe("getSignatureLayout", () => {
  test("shows the Draw / Type toggle, and the name field in Type mode, when typed signatures are on", () => {
    expect(getSignatureLayout(true, "draw")).toEqual({
      showModeToggle: true,
      mode: "draw",
      showNameInput: false,
    });
    expect(getSignatureLayout(true, "type")).toEqual({
      showModeToggle: true,
      mode: "type",
      showNameInput: true,
    });
  });

  test("renders no toggle and no name field when typed signatures are off, even for a value left in Type", () => {
    expect(getSignatureLayout(false, "draw")).toEqual({
      showModeToggle: false,
      mode: "draw",
      showNameInput: false,
    });
    expect(getSignatureLayout(false, "type")).toEqual({
      showModeToggle: false,
      mode: "draw",
      showNameInput: false,
    });
  });
});

describe("nextSignatureMode", () => {
  test("arrows move between the two tabs and wrap", () => {
    expect(nextSignatureMode("ArrowRight", "draw", "ltr")).toBe("type");
    expect(nextSignatureMode("ArrowRight", "type", "ltr")).toBe("draw");
    expect(nextSignatureMode("ArrowLeft", "draw", "ltr")).toBe("type");
  });

  test("arrows are mirrored in a right-to-left survey", () => {
    expect(nextSignatureMode("ArrowLeft", "draw", "rtl")).toBe("type");
    expect(nextSignatureMode("ArrowRight", "type", "rtl")).toBe("draw");
  });

  test("Home and End jump to the ends; other keys do nothing", () => {
    expect(nextSignatureMode("Home", "type", "ltr")).toBe("draw");
    expect(nextSignatureMode("End", "draw", "ltr")).toBe("type");
    expect(nextSignatureMode("Enter", "draw", "ltr")).toBeNull();
    expect(nextSignatureMode("ArrowDown", "draw", "ltr")).toBeNull();
  });
});

describe("getSignatureViewState", () => {
  const base = { allowTypedSignature: true, hasSavedSignature: false, disabled: false, isUploading: false };
  const drawing = {
    ...EMPTY_SIGNATURE,
    strokes: [
      [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    ],
  };

  test("a stored URL with nothing kept in memory shows as saved and signed, and locks drawing", () => {
    const state = getSignatureViewState({ ...base, value: EMPTY_SIGNATURE, hasSavedSignature: true });
    expect(state).toMatchObject({
      hasSavedOnly: true,
      isSigned: true,
      hasAnyInput: true,
      drawingEnabled: false,
    });
  });

  test("once the pad holds input the stored URL no longer decides: an empty Type tab is not signed", () => {
    const state = getSignatureViewState({
      ...base,
      value: { ...drawing, mode: "type" },
      hasSavedSignature: true,
    });
    expect(state).toMatchObject({
      hasSavedOnly: false,
      isSigned: false,
      hasActiveInput: false,
      mode: "type",
    });
  });

  test("with typed signatures off the pad is always Draw", () => {
    const state = getSignatureViewState({
      ...base,
      allowTypedSignature: false,
      value: { ...drawing, mode: "type", typedName: "Ann" },
    });
    expect(state).toMatchObject({
      mode: "draw",
      showModeToggle: false,
      isSigned: true,
      hasActiveInput: true,
    });
  });

  test("uploading or disabled locks the pad", () => {
    expect(getSignatureViewState({ ...base, value: drawing, isUploading: true })).toMatchObject({
      locked: true,
      drawingEnabled: false,
    });
    expect(getSignatureViewState({ ...base, value: drawing, disabled: true }).locked).toBe(true);
    expect(getSignatureViewState({ ...base, value: drawing }).drawingEnabled).toBe(true);
  });
});
