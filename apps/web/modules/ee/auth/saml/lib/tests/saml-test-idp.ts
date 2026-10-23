import { DSIG_NS, PROTOCOL_NS, createSigningIdp } from "./saml-test-signing";

/**
 * A SAML identity provider for the ENG-4045 tests: its metadata, and responses to an AuthnRequest signed as Okta and
 * Entra sign them, optionally encrypted to the SP (saml-test-signing.ts).
 */

export interface SignedResponseOptions {
  /** The AuthnRequest's ID, as InResponseTo. */
  requestId: string;
  /** The SP's assertion consumer service URL. */
  acsUrl: string;
  /** The SP's entity ID, as the audience. */
  audience: string;
  email: string;
  /** The SP's public key: when set, the signed assertion is sent encrypted to it, as an EncryptedAssertion. */
  encryptFor?: string;
}

export const createTestIdp = (entityId = "https://idp.example.com/saml") => {
  const { certificate, certificateBody, signedResponse: sign } = createSigningIdp();
  const ssoUrl = `${entityId}/sso`;

  const metadata =
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">` +
    `<md:IDPSSODescriptor WantAuthnRequestsSigned="true" protocolSupportEnumeration="${PROTOCOL_NS}">` +
    `<md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="${DSIG_NS}"><ds:X509Data>` +
    `<ds:X509Certificate>${certificateBody}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>` +
    "<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>" +
    `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${ssoUrl}"/>` +
    `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${ssoUrl}"/>` +
    "</md:IDPSSODescriptor></md:EntityDescriptor>";

  /** A successful response to `requestId`, its assertion signed with the IdP's key; base64, as the POST binding sends it. */
  const signedResponse = ({
    requestId,
    acsUrl,
    audience,
    email,
    encryptFor,
  }: SignedResponseOptions): string =>
    sign({
      issuer: entityId,
      acsUrl,
      audience,
      email,
      inResponseTo: requestId,
      attributes: [
        ["firstName", "Test"],
        ["lastName", "User"],
      ],
      encryptFor,
    });

  return { entityId, ssoUrl, certificate, metadata, signedResponse };
};
