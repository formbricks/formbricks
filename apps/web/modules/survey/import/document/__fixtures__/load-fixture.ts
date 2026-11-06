import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

/** A document fixture's bytes, as the upload hands them over. */
export const loadDocumentFixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(FIXTURE_DIR, name)));

/** A text fixture decoded as the upload's sniffer decodes it: UTF-8, byte-order mark dropped. */
export const loadDocumentFixtureText = (name: string): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(loadDocumentFixture(name));
