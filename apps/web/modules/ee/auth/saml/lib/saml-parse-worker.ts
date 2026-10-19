import { DOMParser, MIME_TYPE } from "@xmldom/xmldom";
import { parentPort } from "node:worker_threads";

/**
 * Worker side of the SAML parse budget (`saml-parse-budget.ts`, ENG-3973). It parses a decoded SAMLResponse
 * exactly as `@boxyhq/saml20` does before jackson trusts anything (an xmldom `DOMParser` whose error handler
 * lets recoverable errors through), so the time it takes here is the time jackson's own parse would block the
 * event loop for. The main thread times each job and terminates this worker when one runs past the budget.
 *
 * It answers with the identifying fields only: the claimed issuer, the response ID and InResponseTo, cut to a
 * length a log line can carry. Nothing else of the response leaves the worker.
 */

const MAX_FIELD_LENGTH = 1024;

const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

const field = (value: string | null | undefined): string | undefined =>
  value ? value.slice(0, MAX_FIELD_LENGTH) : undefined;

const readClaims = (xml: string) => {
  const root = new DOMParser({ onError: () => undefined }).parseFromString(
    xml,
    MIME_TYPE.XML_APPLICATION
  ).documentElement;
  if (!root) return {};

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

parentPort?.on("message", ({ id, xml }: { id: number; xml: string }) => {
  let claims = {};
  try {
    claims = readClaims(xml);
  } catch {
    // A fatal parse error is cheap, and jackson refuses the response on its own; the cost is what is measured.
  }
  parentPort?.postMessage({ id, claims });
});

parentPort?.postMessage({ ready: true });
