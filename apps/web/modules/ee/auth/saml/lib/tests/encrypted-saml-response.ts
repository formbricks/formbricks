import { constants, createCipheriv, generateKeyPairSync, publicEncrypt, randomBytes } from "node:crypto";

/**
 * SAML responses carrying an encrypted assertion, for the ENG-4051 tests: the shapes an IdP sends, encrypted to a
 * throwaway SP key pair that stands in for jackson's default certificate.
 */

const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
export const ENCRYPTED_RESPONSE_ISSUER = "https://idp.example.com";

/** A fresh RSA key pair in the PEM forms jackson stores its SP certificate's keys in. */
export const createSpKeyPair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

/**
 * `plaintext` encrypted as an IdP encrypts an assertion (XML Encryption 1.1: AES-256-GCM content, its key wrapped
 * with RSA-OAEP for `spPublicKey`).
 */
export const encryptAssertion = (plaintext: string, spPublicKey: string): string => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  // XML Encryption 1.1 carries GCM as the IV, the ciphertext, then the tag.
  const content = Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
  const wrappedKey = publicEncrypt(
    { key: spPublicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    key
  ).toString("base64");
  return (
    `<saml2:EncryptedAssertion xmlns:saml2="${ASSERTION_NS}">` +
    '<xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" Type="http://www.w3.org/2001/04/xmlenc#Element">' +
    '<xenc:EncryptionMethod Algorithm="http://www.w3.org/2009/xmlenc11#aes256-gcm"/>' +
    '<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><xenc:EncryptedKey>' +
    '<xenc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p">' +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/></xenc:EncryptionMethod>' +
    `<xenc:CipherData><xenc:CipherValue>${wrappedKey}</xenc:CipherValue></xenc:CipherData>` +
    "</xenc:EncryptedKey></ds:KeyInfo>" +
    `<xenc:CipherData><xenc:CipherValue>${content}</xenc:CipherValue></xenc:CipherData>` +
    "</xenc:EncryptedData></saml2:EncryptedAssertion>"
  );
};

/** A response from `ENCRYPTED_RESPONSE_ISSUER` wrapping `inner`. */
export const samlResponseWith = (inner: string): string =>
  '<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp1" InResponseTo="_req1" Version="2.0">' +
  `<saml2:Issuer xmlns:saml2="${ASSERTION_NS}">${ENCRYPTED_RESPONSE_ISSUER}</saml2:Issuer>` +
  '<saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></saml2p:Status>' +
  `${inner}</saml2p:Response>`;

const value = (text: string) =>
  '<saml2:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" ' +
  `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${text}</saml2:AttributeValue>`;

/**
 * A signed assertion as Okta writes one, carrying `groups` group values. The signature is shaped like a real one
 * (enveloped, exclusive c14n, RSA-SHA256, an X.509 key) so the assertion costs what a real one does to parse; the
 * worker never checks it.
 */
export const signedAssertionWithGroups = (groups: number): string =>
  `<saml2:Assertion xmlns:saml2="${ASSERTION_NS}" ID="_assert1" IssueInstant="2026-10-21T10:00:00Z" Version="2.0">` +
  `<saml2:Issuer>${ENCRYPTED_RESPONSE_ISSUER}</saml2:Issuer>` +
  '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>' +
  '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>' +
  '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
  '<ds:Reference URI="#_assert1"><ds:Transforms>' +
  '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
  '<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms>' +
  '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>' +
  `<ds:DigestValue>${"A".repeat(44)}</ds:DigestValue></ds:Reference></ds:SignedInfo>` +
  `<ds:SignatureValue>${"B".repeat(344)}</ds:SignatureValue>` +
  `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${"C".repeat(1_000)}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
  "</ds:Signature>" +
  '<saml2:Subject><saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml2:NameID>' +
  '<saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
  '<saml2:SubjectConfirmationData InResponseTo="_req1" NotOnOrAfter="2026-10-21T10:05:00Z"/></saml2:SubjectConfirmation></saml2:Subject>' +
  '<saml2:Conditions NotBefore="2026-10-21T09:55:00Z" NotOnOrAfter="2026-10-21T10:05:00Z"><saml2:AudienceRestriction>' +
  "<saml2:Audience>https://saml.formbricks.com</saml2:Audience></saml2:AudienceRestriction></saml2:Conditions>" +
  '<saml2:AttributeStatement><saml2:Attribute Name="email">' +
  value("user@example.com") +
  '</saml2:Attribute><saml2:Attribute Name="groups">' +
  Array.from({ length: groups }, (_, i) =>
    value(`CN=Group ${i} Engineering,OU=Groups,DC=corp,DC=example,DC=com`)
  ).join("") +
  "</saml2:Attribute></saml2:AttributeStatement></saml2:Assertion>";

/**
 * An assertion holding `levels` nested namespace scopes. xmldom chains each onto its parent, so parsing costs the
 * square of the depth: 4,000 levels take jackson ~0.9 s, and encrypted they pass every byte bound, which only sees the
 * ciphertext.
 */
export const nestedNamespaceAssertion = (levels: number): string =>
  `<saml2:Assertion xmlns:saml2="${ASSERTION_NS}" ID="_assert1" Version="2.0">` +
  `<saml2:Issuer>${ENCRYPTED_RESPONSE_ISSUER}</saml2:Issuer>` +
  Array.from({ length: levels }, (_, i) => `<a xmlns:p${i}="u">`).join("") +
  "</a>".repeat(levels) +
  "</saml2:Assertion>";

/**
 * An assertion holding `elements` empty elements: cheap for xmldom (~30 ms for 30,000), but jackson's later passes
 * over the decrypted document (xml2js, the signature check's XPath scans) cost several times that. Past the markup
 * budget, an unencrypted response like it is refused before jackson.
 */
export const flatAssertion = (elements: number): string =>
  `<saml2:Assertion xmlns:saml2="${ASSERTION_NS}" ID="_assert1" Version="2.0">` +
  `<saml2:Issuer>${ENCRYPTED_RESPONSE_ISSUER}</saml2:Issuer>` +
  "<a/>".repeat(elements) +
  "</saml2:Assertion>";
