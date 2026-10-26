import { decryptXml } from "@boxyhq/saml20/dist/decrypt.js";
import { DOMParser, type Element, MIME_TYPE } from "@xmldom/xmldom";
import { type MessagePort, workerData } from "node:worker_threads";
// Type-only, so erased: the worker never loads the pool's module.
import type { SamlResponseClaims } from "./saml-parse-budget";
// With its extension: the worker also runs as a plain Node worker thread (in unit tests), which resolves no other way.
import { type SamlDecryptedRefusal, checkDecryptedSamlResponseBounds } from "./saml-response-bounds.ts";

/**
 * Worker side of the SAML parse budget (`saml-parse-budget.ts`, ENG-3973). It parses a decoded SAMLResponse exactly
 * as `@boxyhq/saml20` does before jackson trusts anything (an xmldom `DOMParser` whose error handler lets recoverable
 * errors through), so the time it takes here is the time one of jackson's parses takes. It times each parse itself
 * and answers over the port it was given; the main thread terminates it when a job runs past the budget.
 *
 * Given the SP key, it also does what jackson does with an encrypted assertion before checking any signature, and
 * holds the decrypted document to the byte bounds, so the plaintext, which the bounds on the response only see as
 * ciphertext, is timed and measured too (ENG-4051).
 *
 * It answers with the identifying fields only (the claimed issuer, the response ID and InResponseTo, cut to a length a
 * log line can carry) and how decryption went, with sizes for a refusal. Nothing else of the response leaves the
 * worker, the decrypted assertion included.
 */

const MAX_FIELD_LENGTH = 1024;

const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

const field = (value: string | null | undefined): string | undefined =>
  value ? value.slice(0, MAX_FIELD_LENGTH) : undefined;

const parseXml = (xml: string) =>
  new DOMParser({ onError: () => undefined }).parseFromString(xml, MIME_TYPE.XML_APPLICATION);

const readClaims = (root: Element): SamlResponseClaims => {
  let issuer: string | undefined;
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (node.namespaceURI === SAML_ASSERTION_NS && node.localName === "Issuer") {
      issuer = field(node.textContent);
      break;
    }
  }
  return {
    issuer,
    id: field(root.getAttribute("ID")),
    inResponseTo: field(root.getAttribute("InResponseTo")),
  };
};

/**
 * Whether jackson will decrypt this response: saml20's `decryptXml` looks for an `EncryptedAssertion` directly under
 * a root whose name contains "Response", whatever their namespaces.
 */
const hasEncryptedAssertion = (root: Element): boolean => {
  if (!root.localName?.includes("Response")) return false;
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (node.localName === "EncryptedAssertion") return true;
  }
  return false;
};

/**
 * What came of an encrypted assertion jackson would decrypt: it decrypted, and the document with it in place passed
 * the byte bounds or was refused by them; or it did not decrypt at all.
 */
export type SamlDecryption =
  | { decrypted: true; refusal: SamlDecryptedRefusal | null }
  /**
   * With jackson's key, an encrypted assertion decrypts here exactly as it will in jackson, so one that does not will
   * fail in jackson too; the pool lets jackson give its usual answer (see its `takeResult`).
   */
  | { decrypted: false };

export interface ParsedSamlResponse {
  claims: SamlResponseClaims;
  /** Only when the response holds an encrypted assertion jackson would decrypt. */
  decryption?: SamlDecryption;
}

/**
 * What jackson does first with an encrypted assertion, before it checks any signature (saml20's `validateInternal`):
 * decrypt it, parse the plaintext and serialize the document with it in place. Then the bounds on that document.
 */
const decryptAsJackson = (xml: string, decryptionKey: string | null): SamlDecryption => {
  if (!decryptionKey) return { decrypted: false };
  try {
    const { assertion, decrypted } = decryptXml(xml, { privateKey: decryptionKey });
    if (!decrypted) return { decrypted: false };
    return { decrypted: true, refusal: checkDecryptedSamlResponseBounds(assertion) };
  } catch {
    return { decrypted: false };
  }
};

/**
 * One job: parse `xml`, and decrypt and measure its encrypted assertion with `decryptionKey` as jackson will. Never
 * throws.
 */
export const parseSamlResponse = (xml: string, decryptionKey: string | null): ParsedSamlResponse => {
  let root: Element | null;
  try {
    root = parseXml(xml).documentElement;
  } catch {
    // A fatal parse error is cheap, and jackson refuses the response on its own; the cost is what is measured.
    return { claims: {} };
  }
  if (!root) return { claims: {} };
  const claims = readClaims(root);
  return hasEncryptedAssertion(root)
    ? { claims, decryption: decryptAsJackson(xml, decryptionKey) }
    : { claims };
};

// Warm xmldom up before the first real job, so a fresh worker does not charge its cold start to a real sign-in.
const WARM_UP =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_w">' +
  '<saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">w</saml2:Issuer>' +
  "<a><b c='d'/></a>".repeat(200) +
  "</samlp:Response>";

/**
 * xml-encryption's warning when a response declares an insecure algorithm (RSA 1.5, Triple DES), which saml20 gives it
 * no option to turn off. Here that is whatever an anonymous sender chose, before jackson has checked who sent it, so
 * the worker drops that one message; jackson still warns when it decrypts a response naming a configured issuer, and
 * every other warning goes through.
 */
const INSECURE_ALGORITHM_WARNING = "is no longer recommended due to security reasons";

export const dropInsecureAlgorithmWarnings =
  (warn: (...args: unknown[]) => void) =>
  (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes(INSECURE_ALGORITHM_WARNING)) return;
    warn(...args);
  };

const serve = (port: MessagePort) => {
  console.warn = dropInsecureAlgorithmWarnings(console.warn.bind(console));
  port.on(
    "message",
    ({ id, xml, decryptionKey }: { id: number; xml: string; decryptionKey: string | null }) => {
      const started = performance.now();
      const { claims, decryption } = parseSamlResponse(xml, decryptionKey);
      port.postMessage({ id, ms: performance.now() - started, claims, decryption });
    }
  );
  for (let i = 0; i < 20; i++) parseSamlResponse(WARM_UP, null);
  port.postMessage({ ready: true });
};

// Started as the pool's worker, it serves the port it was given. Imported anywhere else (its unit test), there is no
// port, and it only exports `parseSamlResponse`.
const workerPort = (workerData as { port?: MessagePort } | null)?.port;
if (workerPort) serve(workerPort);
