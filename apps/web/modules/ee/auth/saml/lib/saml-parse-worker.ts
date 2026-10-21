import { decryptXml } from "@boxyhq/saml20/dist/decrypt.js";
import { DOMParser, type Element, MIME_TYPE } from "@xmldom/xmldom";
import { type MessagePort, workerData } from "node:worker_threads";
// Type-only, so erased: the worker never loads the pool's module.
import type { SamlResponseClaims } from "./saml-parse-budget";

/**
 * Worker side of the SAML parse budget (`saml-parse-budget.ts`, ENG-3973). It parses a decoded SAMLResponse exactly
 * as `@boxyhq/saml20` does before jackson trusts anything (an xmldom `DOMParser` whose error handler lets recoverable
 * errors through), so the time it takes here is the time one of jackson's parses takes. It times each parse itself
 * and answers over the port it was given; the main thread terminates it when a job runs past the budget.
 *
 * Given the SP key, it also does what jackson does with an encrypted assertion before checking any signature, so the
 * plaintext, which no byte bound sees, is timed too (ENG-4051).
 *
 * It answers with the identifying fields only (the claimed issuer, the response ID and InResponseTo, cut to a length a
 * log line can carry) and, for an encrypted assertion it decrypted, the decrypted document, which the pool measures
 * and drops. Nothing else of the response leaves the worker.
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

export interface ParsedSamlResponse {
  claims: SamlResponseClaims;
  /**
   * The response with its encrypted assertion decrypted and put in place, when there was one to decrypt: the
   * document jackson validates from then on. The pool holds it to the byte bounds, which only saw ciphertext.
   */
  decryptedXml?: string;
}

/**
 * One job: parse `xml`, decrypt its encrypted assertion with `decryptionKey` as jackson will, and return the claims
 * and the decrypted document. Never throws.
 */
export const parseSamlResponse = (xml: string, decryptionKey: string | undefined): ParsedSamlResponse => {
  const parsed: ParsedSamlResponse = { claims: {} };
  try {
    const root = parseXml(xml).documentElement;
    if (!root) return parsed;
    parsed.claims = readClaims(root);
    // What jackson does first with an encrypted assertion, before it checks any signature (saml20's
    // `validateInternal`): decrypt it, parse the plaintext and serialize the document with it in place.
    if (decryptionKey && hasEncryptedAssertion(root)) {
      const { assertion, decrypted } = decryptXml(xml, { privateKey: decryptionKey });
      if (decrypted) parsed.decryptedXml = assertion;
    }
  } catch {
    // A fatal parse error or a failed decryption is cheap, and jackson refuses the response on its own; the cost is
    // what is measured.
  }
  return parsed;
};

// Warm xmldom up before the first real job, so a fresh worker does not charge its cold start to a real sign-in.
const WARM_UP =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_w">' +
  '<saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">w</saml2:Issuer>' +
  "<a><b c='d'/></a>".repeat(200) +
  "</samlp:Response>";

const serve = (port: MessagePort) => {
  // xml-encryption warns on stderr when a response declares an insecure algorithm (RSA 1.5, Triple DES). Here that is
  // whatever an anonymous sender chose, before jackson has checked who sent it, so the worker keeps quiet; jackson
  // still warns when it decrypts a response it accepted.
  console.warn = () => undefined;
  port.on("message", ({ id, xml, decryptionKey }: { id: number; xml: string; decryptionKey?: string }) => {
    const started = performance.now();
    const { claims, decryptedXml } = parseSamlResponse(xml, decryptionKey);
    port.postMessage({ id, ms: performance.now() - started, claims, decryptedXml });
  });
  for (let i = 0; i < 20; i++) parseSamlResponse(WARM_UP, undefined);
  port.postMessage({ ready: true });
};

// Started as the pool's worker, it serves the port it was given. Imported anywhere else (its unit test), there is no
// port, and it only exports `parseSamlResponse`.
const workerPort = (workerData as { port?: MessagePort } | null)?.port;
if (workerPort) serve(workerPort);
