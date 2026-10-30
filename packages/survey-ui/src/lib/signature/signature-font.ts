import { SIGNATURE_FONT_FAMILY } from "./signature-draw";

interface FontFaceLike {
  load: () => Promise<unknown>;
}

export interface SignatureFontEnvironment {
  createFontFace: (family: string, source: string, descriptors: Record<string, string>) => FontFaceLike;
  addToDocument: (face: FontFaceLike) => void;
}

/** The browser's own FontFace API, or `null` where there is none (old WebViews, server rendering). */
const browserEnvironment = (): SignatureFontEnvironment | null => {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !("fonts" in document)) {
    return null;
  }
  return {
    createFontFace: (family, source, descriptors) => new FontFace(family, source, descriptors),
    addToDocument: (face) => document.fonts.add(face as FontFace),
  };
};

const loads = new Map<string, Promise<boolean>>();

/** How long a draw waits for the font before giving up and using the system cursive font. */
export const FONT_LOAD_TIMEOUT_MS = 4000;

/**
 * Loads the typed-signature font from `url` and registers it with the document, resolving `true` once
 * canvas text can use it and `false` if it cannot (no FontFace API, offline, blocked by a page's
 * content security policy). Never rejects: the caller draws with the system cursive fallback.
 *
 * Canvas text resolves families against `document.fonts` even when the canvas sits inside a shadow
 * root, which is why the face is added there rather than through a stylesheet in the survey's styles.
 * One request per URL; a failed load is forgotten so a later call can try again.
 */
export const loadSignatureFont = (
  url: string,
  environment: SignatureFontEnvironment | null = browserEnvironment(),
  timeoutMs: number = FONT_LOAD_TIMEOUT_MS
): Promise<boolean> => {
  const existing = loads.get(url);
  if (existing) return existing;
  if (!environment) return Promise.resolve(false);

  const load = (async (): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const face = environment.createFontFace(SIGNATURE_FONT_FAMILY, `url(${JSON.stringify(url)})`, {
        style: "normal",
        weight: "400 700",
        display: "swap",
      });
      // A stalled request must not hold up a draw or an upload: past the timeout the caller moves on with
      // the fallback font. A face that arrives late is still registered, for the next draw.
      const loaded = face.load().then(() => {
        environment.addToDocument(face);
        return true;
      });
      const timedOut = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          loads.delete(url);
          resolve(false);
        }, timeoutMs);
      });
      return await Promise.race([loaded, timedOut]);
    } catch {
      loads.delete(url);
      return false;
    } finally {
      clearTimeout(timer);
    }
  })();

  loads.set(url, load);
  return load;
};

/** Forgets every cached load. For tests. */
export const resetSignatureFontCache = (): void => {
  loads.clear();
};
