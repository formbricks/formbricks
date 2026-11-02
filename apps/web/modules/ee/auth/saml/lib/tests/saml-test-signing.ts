import { createHash, createSign, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { encryptAssertion } from "./encrypted-saml-response";

/**
 * What the test IdPs (saml-test-idp.ts, signed-saml-response.ts) share: a key and certificate, and responses whose
 * assertion is signed as Okta and Entra sign it (an enveloped RSA-SHA256 signature, exclusive c14n, the certificate in
 * KeyInfo), optionally encrypted to the SP.
 *
 * The signature is built here with `node:crypto` rather than xml-crypto, which is the library under test: the
 * assertion and SignedInfo are written already in their exclusive-c14n form (namespaces declared where they are
 * used, attributes in order, no empty-element tags, nothing to escape), so their digest is the digest of the string.
 */

export const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
export const DSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

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

export interface ResponseOptions {
  /** The IdP's entity ID, as the response's and the assertion's Issuer. */
  issuer: string;
  /** The SP's assertion consumer service URL. */
  acsUrl: string;
  /** The SP's entity ID, as the audience. */
  audience: string;
  email: string;
  /** The AuthnRequest's ID, for an SP-initiated response; unsolicited without it. */
  inResponseTo?: string;
  /** Attribute name and value pairs, in order; an `email` attribute is always first. */
  attributes?: [name: string, value: string][];
  /** The SP's public key: when set, the signed assertion is sent encrypted to it, as an EncryptedAssertion. */
  encryptFor?: string;
}

/** An IdP's signing key and certificate, and the successful responses it signs. */
export const createSigningIdp = () => {
  const { certificate, privateKey } = createSelfSignedCertificate("Formbricks test IdP");
  // The base64 DER that SAML metadata and KeyInfo carry.
  const certificateBody = certificate.replaceAll(/-----[^-]+-----/g, "").replaceAll(/\s/g, "");

  /** A successful response, its assertion signed with the IdP's key; base64, as the POST binding sends it. */
  const signedResponse = ({
    issuer,
    acsUrl,
    audience,
    email,
    inResponseTo,
    attributes = [],
    encryptFor,
  }: ResponseOptions): string => {
    const now = Date.now();
    const instant = new Date(now).toISOString();
    const notBefore = new Date(now - 5 * 60 * 1000).toISOString();
    const notOnOrAfter = new Date(now + 10 * 60 * 1000).toISOString();
    const assertionId = `_${randomUUID()}`;
    const inResponseToAttribute = inResponseTo ? `InResponseTo="${inResponseTo}" ` : "";

    const attributeStatement = [["email", email], ...attributes]
      .map(
        ([name, value]) =>
          `<saml2:Attribute Name="${name}"><saml2:AttributeValue>${value}</saml2:AttributeValue></saml2:Attribute>`
      )
      .join("");
    const body =
      "<saml2:Subject>" +
      `<saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml2:NameID>` +
      '<saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
      `<saml2:SubjectConfirmationData ${inResponseToAttribute}NotOnOrAfter="${notOnOrAfter}" Recipient="${acsUrl}">` +
      "</saml2:SubjectConfirmationData></saml2:SubjectConfirmation></saml2:Subject>" +
      `<saml2:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
      `<saml2:AudienceRestriction><saml2:Audience>${audience}</saml2:Audience></saml2:AudienceRestriction>` +
      "</saml2:Conditions>" +
      `<saml2:AuthnStatement AuthnInstant="${instant}" SessionIndex="${assertionId}"><saml2:AuthnContext>` +
      "<saml2:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport" +
      "</saml2:AuthnContextClassRef></saml2:AuthnContext></saml2:AuthnStatement>" +
      `<saml2:AttributeStatement>${attributeStatement}</saml2:AttributeStatement>`;
    const assertionIssuer = `<saml2:Issuer>${issuer}</saml2:Issuer>`;
    const openAssertion = `<saml2:Assertion xmlns:saml2="${ASSERTION_NS}" ID="${assertionId}" IssueInstant="${instant}" Version="2.0">`;

    // The enveloped-signature transform removes the Signature, so the digest covers the assertion without it.
    const digest = createHash("sha256")
      .update(`${openAssertion}${assertionIssuer}${body}</saml2:Assertion>`, "utf8")
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
    const assertion = `${openAssertion}${assertionIssuer}${signature}${body}</saml2:Assertion>`;

    const response =
      `<saml2p:Response xmlns:saml2p="${PROTOCOL_NS}" Destination="${acsUrl}" ID="_${randomUUID()}" ` +
      `${inResponseToAttribute}IssueInstant="${instant}" Version="2.0">` +
      `<saml2:Issuer xmlns:saml2="${ASSERTION_NS}">${issuer}</saml2:Issuer>` +
      `<saml2p:Status><saml2p:StatusCode Value="${PROTOCOL_NS.replace("protocol", "status")}:Success"/></saml2p:Status>` +
      `${encryptFor ? encryptAssertion(assertion, encryptFor) : assertion}</saml2p:Response>`;
    return Buffer.from(response, "utf8").toString("base64");
  };

  return { certificate, certificateBody, signedResponse };
};
