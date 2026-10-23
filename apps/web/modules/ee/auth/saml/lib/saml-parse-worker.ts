import { decryptXml } from "@boxyhq/saml20/dist/decrypt.js";
import { parseIssuer } from "@boxyhq/saml20/dist/response.js";
import { validateSignature } from "@boxyhq/saml20/dist/validateSignature.js";
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
 * ciphertext, is timed and measured too (ENG-4051). It runs saml20's `parseIssuer`, jackson's first use of the
 * response, so that call's cost is timed as well (ENG-6648), then saml20's signature check with the connection's own
 * IdP certificates, so that step's cost is timed too (ENG-4108).
 *
 * It answers with the identifying fields only (the claimed issuer, the response ID and InResponseTo, cut to a length a
 * log line can carry) and how decryption went, with sizes for a refusal. Nothing else of the response leaves the
 * worker, the decrypted assertion included.
 */

const MAX_FIELD_LENGTH = 1024;

const field = (value: string | null | undefined): string | undefined =>
  value ? value.slice(0, MAX_FIELD_LENGTH) : undefined;

const parseXml = (xml: string) =>
  new DOMParser({ onError: () => undefined }).parseFromString(xml, MIME_TYPE.XML_APPLICATION);

/**
 * jackson's first use of the response (saml20's `parseIssuer`): it parses the whole response and selects the `Issuer`
 * children of its root, on every callback, before any issuer, connection or RelayState check. The select's cost grows
 * with the square of the elements it matches, so the byte bounds cap its names (ENG-6648); calling it here puts
 * jackson's actual call inside the budget too, so a shape the bounds misread is still cut off. Returns `undefined` for
 * a response saml20 cannot parse, which jackson refuses on its own.
 */
const issuerAsJackson = (xml: string): string | undefined => {
  try {
    return parseIssuer(xml);
  } catch {
    return undefined;
  }
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
 * Returns the decrypted document too, for the signature check after it (it never leaves the worker), and whether
 * jackson gets as far as that check at all: not when it has no key to decrypt with, nor when decryption throws.
 */
const decryptAsJackson = (
  xml: string,
  decryptionKey: string | null
): { decryption: SamlDecryption; decryptedXml?: string; checksSignature: boolean } => {
  if (!decryptionKey) return { decryption: { decrypted: false }, checksSignature: false };
  try {
    const { assertion, decrypted } = decryptXml(xml, { privateKey: decryptionKey });
    if (!decrypted) return { decryption: { decrypted: false }, checksSignature: true };
    const refusal = checkDecryptedSamlResponseBounds(assertion);
    // A refused document never reaches jackson, so there is no signature check to time.
    return { decryption: { decrypted: true, refusal }, decryptedXml: assertion, checksSignature: !refusal };
  } catch {
    return { decryption: { decrypted: false }, checksSignature: false };
  }
};

/**
 * What jackson checks a response's signature with, read from the configured connection (see `lib/jackson.ts`): its
 * IdP certificates, comma-joined when there are several, or else its thumbprint. Public data, from the IdP's metadata.
 */
export type SamlIdpVerification = { publicKey: string } | { thumbprint: string };

/**
 * jackson's signature check (saml20's `validateInternal`), with the same certificates and in the same order, so its
 * cost is timed as jackson will spend it: saml20 tries each certificate in turn, the whole check each time, so a
 * connection with several costs several times as much when none matches (ENG-4108). First the document jackson
 * validates (the decrypted one, when there is one); then, only when that check finds no signature without failing,
 * the response as received, which saml20 falls back to for IdPs that sign the encrypted response. Its outcome is
 * jackson's to decide; here it is only timed.
 */
const checkSignatureAsJackson = (
  xml: string,
  decryptedXml: string | undefined,
  idpVerification: SamlIdpVerification
) => {
  const publicKey = "publicKey" in idpVerification ? idpVerification.publicKey : null;
  const thumbprint = "thumbprint" in idpVerification ? idpVerification.thumbprint : null;
  let signed: string | null;
  try {
    signed = validateSignature(decryptedXml ?? xml, publicKey, thumbprint);
  } catch {
    return;
  }
  if (decryptedXml === undefined || signed) return;
  try {
    validateSignature(xml, publicKey, thumbprint);
  } catch {
    // jackson fails the response the same way.
  }
};

/**
 * One job: parse `xml` as jackson does, decrypt and measure its encrypted assertion with `decryptionKey`, then run
 * jackson's signature check on it with `idpVerification` (`null` when no connection is configured, where jackson
 * refuses before validating). Never throws.
 */
export const parseSamlResponse = (
  xml: string,
  decryptionKey: string | null,
  idpVerification: SamlIdpVerification | null
): ParsedSamlResponse => {
  // jackson's first call on the response, timed here before anything else as jackson does it (ENG-6648).
  const issuer = issuerAsJackson(xml);
  let root: Element | null;
  try {
    root = parseXml(xml).documentElement;
  } catch {
    // A fatal parse error is cheap, and jackson refuses the response on its own; the cost is what is measured.
    return { claims: {} };
  }
  if (!root) return { claims: {} };
  const claims: SamlResponseClaims = {
    issuer: field(issuer),
    id: field(root.getAttribute("ID")),
    inResponseTo: field(root.getAttribute("InResponseTo")),
  };
  if (!hasEncryptedAssertion(root)) {
    if (idpVerification) checkSignatureAsJackson(xml, undefined, idpVerification);
    return { claims };
  }
  const { decryption, decryptedXml, checksSignature } = decryptAsJackson(xml, decryptionKey);
  if (idpVerification && checksSignature) checkSignatureAsJackson(xml, decryptedXml, idpVerification);
  return { claims, decryption };
};

/**
 * Warms xmldom and the signature check (xml-crypto's canonicalization and digest) up before the first real job, so a
 * fresh worker does not charge its cold start to a real sign-in. The signature is not valid, and the certificate is not
 * one: the check does its work and then fails on the key, which is all the warm-up needs.
 */
const WARM_UP =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_w">' +
  '<saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">w</saml2:Issuer>' +
  '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>' +
  '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
  '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
  '<ds:Reference URI="#_w"><ds:Transforms>' +
  '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
  '<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms>' +
  '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>w</ds:DigestValue>' +
  "</ds:Reference></ds:SignedInfo><ds:SignatureValue>w</ds:SignatureValue></ds:Signature>" +
  "<a><b c='d'/></a>".repeat(200) +
  "</samlp:Response>";
const WARM_UP_VERIFICATION: SamlIdpVerification = { publicKey: "warm-up" };

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
    ({
      id,
      xml,
      decryptionKey,
      idpVerification,
    }: {
      id: number;
      xml: string;
      decryptionKey: string | null;
      idpVerification: SamlIdpVerification | null;
    }) => {
      const started = performance.now();
      const { claims, decryption } = parseSamlResponse(xml, decryptionKey, idpVerification);
      port.postMessage({ id, ms: performance.now() - started, claims, decryption });
    }
  );
  for (let i = 0; i < 20; i++) parseSamlResponse(WARM_UP, null, WARM_UP_VERIFICATION);
  port.postMessage({ ready: true });
};

// Started as the pool's worker, it serves the port it was given. Imported anywhere else (its unit test), there is no
// port, and it only exports `parseSamlResponse`.
const workerPort = (workerData as { port?: MessagePort } | null)?.port;
if (workerPort) serve(workerPort);
