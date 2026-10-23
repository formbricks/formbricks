import { createHash, createSign, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { encryptAssertion } from "./encrypted-saml-response";

/**
 * A signed SAML response for the ENG-6648 tests: an enveloped RSA-SHA256 signature over the assertion, as Okta and
 * Entra send one (exclusive c14n, the certificate in KeyInfo), optionally encrypted to the SP.
 *
 * The signature is built with `node:crypto` rather than xml-crypto, whose validation path the tests exercise. The
 * assertion and its SignedInfo are written already in their exclusive-c14n form — namespaces declared where they are
 * used, nothing to escape — so their digest is the digest of the string.
 */

const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

export const SIGNED_RESPONSE_ISSUER = "https://idp.example.com/saml";
export const SIGNED_RESPONSE_AUDIENCE = "https://saml.formbricks.com";
const ACS_URL = `${SIGNED_RESPONSE_AUDIENCE}/api/auth/saml/callback`;

interface ForgeCertificate {
  publicKey: unknown;
  serialNumber: string;
  validity: { notBefore: Date; notAfter: Date };
  setSubject(attrs: { name: string; value: string }[]): void;
  setIssuer(attrs: { name: string; value: string }[]): void;
  sign(key: unknown, md: unknown): void;
}

interface Forge {
  pki: {
    rsa: { generateKeyPair(bits: number): { publicKey: unknown; privateKey: unknown } };
    createCertificate(): ForgeCertificate;
    certificateToPem(cert: ForgeCertificate): string;
    privateKeyToPem(key: unknown): string;
  };
  md: { sha256: { create(): unknown } };
}

/**
 * A self-signed certificate and its key. Node cannot issue X.509 certificates, so this uses node-forge, the library
 * jackson issues its own SP certificate with, resolved through jackson rather than added as a dependency.
 */
const createSelfSignedCertificate = (commonName: string) => {
  const require = createRequire(createRequire(import.meta.url).resolve("@boxyhq/saml-jackson"));
  const forge = require("node-forge") as Forge;
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const subject = [{ name: "commonName", value: commonName }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certificate: forge.pki.certificateToPem(cert),
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
  };
};

export interface SignedResponseOptions {
  /** Group values the assertion carries, so the response is the size a real one is. */
  groups?: number;
  /** The SP's public key: when set, the signed assertion is sent encrypted to it, as an EncryptedAssertion. */
  encryptFor?: string;
}

/** An IdP whose responses are really signed, for the bounds and validation tests. */
export const createSignedSamlIdp = () => {
  const { certificate, privateKey } = createSelfSignedCertificate("Formbricks test IdP");
  // The base64 DER that SAML metadata and KeyInfo carry.
  const certificateBody = certificate.replaceAll(/-----[^-]+-----/g, "").replaceAll(/\s/g, "");

  /** A successful response, signed with the IdP's key; base64, as the POST binding sends it. */
  const signedResponse = ({ groups = 3, encryptFor }: SignedResponseOptions = {}): string => {
    const now = Date.now();
    const instant = new Date(now).toISOString();
    const notBefore = new Date(now - 5 * 60 * 1000).toISOString();
    const notOnOrAfter = new Date(now + 10 * 60 * 1000).toISOString();
    const assertionId = `_${randomUUID()}`;

    const issuer = `<saml2:Issuer>${SIGNED_RESPONSE_ISSUER}</saml2:Issuer>`;
    const attributes = [
      ["email", "ada@example.com"],
      ...Array.from({ length: groups }, (_, i) => [
        "groups",
        `CN=Group ${i} Engineering,OU=Groups,DC=corp,DC=example,DC=com`,
      ]),
    ]
      .map(
        ([name, value]) =>
          `<saml2:Attribute Name="${name}"><saml2:AttributeValue>${value}</saml2:AttributeValue></saml2:Attribute>`
      )
      .join("");
    const body =
      "<saml2:Subject>" +
      '<saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">ada@example.com</saml2:NameID>' +
      '<saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
      `<saml2:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" Recipient="${ACS_URL}">` +
      "</saml2:SubjectConfirmationData></saml2:SubjectConfirmation></saml2:Subject>" +
      `<saml2:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
      `<saml2:AudienceRestriction><saml2:Audience>${SIGNED_RESPONSE_AUDIENCE}</saml2:Audience></saml2:AudienceRestriction>` +
      "</saml2:Conditions>" +
      `<saml2:AuthnStatement AuthnInstant="${instant}" SessionIndex="${assertionId}"><saml2:AuthnContext>` +
      "<saml2:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport" +
      "</saml2:AuthnContextClassRef></saml2:AuthnContext></saml2:AuthnStatement>" +
      `<saml2:AttributeStatement>${attributes}</saml2:AttributeStatement>`;
    const openAssertion = `<saml2:Assertion xmlns:saml2="${ASSERTION_NS}" ID="${assertionId}" IssueInstant="${instant}" Version="2.0">`;

    // The enveloped-signature transform removes the Signature, so the digest covers the assertion without it.
    const digest = createHash("sha256")
      .update(`${openAssertion}${issuer}${body}</saml2:Assertion>`, "utf8")
      .digest("base64");
    const signedInfo = (xmlns: string) =>
      `<ds:SignedInfo${xmlns}>` +
      `<ds:CanonicalizationMethod Algorithm="${EXC_C14N}"></ds:CanonicalizationMethod>` +
      '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>' +
      `<ds:Reference URI="#${assertionId}"><ds:Transforms>` +
      `<ds:Transform Algorithm="${DSIG_NS}enveloped-signature"></ds:Transform>` +
      `<ds:Transform Algorithm="${EXC_C14N}"></ds:Transform></ds:Transforms>` +
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>' +
      `<ds:DigestValue>${digest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
    // Canonicalized on its own, SignedInfo carries the `ds` declaration it inherits from Signature in the document.
    const signatureValue = createSign("RSA-SHA256")
      .update(signedInfo(` xmlns:ds="${DSIG_NS}"`), "utf8")
      .sign(privateKey, "base64");
    const signature =
      `<ds:Signature xmlns:ds="${DSIG_NS}">${signedInfo("")}` +
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
      `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certificateBody}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
      "</ds:Signature>";
    const assertion = `${openAssertion}${issuer}${signature}${body}</saml2:Assertion>`;

    const response =
      `<saml2p:Response xmlns:saml2p="${PROTOCOL_NS}" Destination="${ACS_URL}" ID="_${randomUUID()}" ` +
      `IssueInstant="${instant}" Version="2.0">` +
      `<saml2:Issuer xmlns:saml2="${ASSERTION_NS}">${SIGNED_RESPONSE_ISSUER}</saml2:Issuer>` +
      `<saml2p:Status><saml2p:StatusCode Value="${PROTOCOL_NS.replace("protocol", "status")}:Success"/></saml2p:Status>` +
      `${encryptFor ? encryptAssertion(assertion, encryptFor) : assertion}</saml2p:Response>`;
    return Buffer.from(response, "utf8").toString("base64");
  };

  return { certificate, signedResponse };
};
