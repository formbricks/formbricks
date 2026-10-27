import { createSigningIdp } from "./saml-test-signing";

/** Signed SAML responses for the ENG-6648 tests: unsolicited, with as many group values as a test asks for. */

export const SIGNED_RESPONSE_ISSUER = "https://idp.example.com/saml";
export const SIGNED_RESPONSE_AUDIENCE = "https://saml.formbricks.com";

export interface SignedResponseOptions {
  /** Group values the assertion carries, so the response is the size a real one is. */
  groups?: number;
  /** The SP's public key: when set, the signed assertion is sent encrypted to it, as an EncryptedAssertion. */
  encryptFor?: string;
}

/** An IdP whose responses are really signed, for the bounds and validation tests. */
export const createSignedSamlIdp = () => {
  const idp = createSigningIdp();

  /** A successful response, signed with the IdP's key; base64, as the POST binding sends it. */
  const signedResponse = ({ groups = 3, encryptFor }: SignedResponseOptions = {}): string =>
    idp.signedResponse({
      issuer: SIGNED_RESPONSE_ISSUER,
      acsUrl: `${SIGNED_RESPONSE_AUDIENCE}/api/auth/saml/callback`,
      audience: SIGNED_RESPONSE_AUDIENCE,
      email: "ada@example.com",
      attributes: Array.from({ length: groups }, (_, i): [string, string] => [
        "groups",
        `CN=Group ${i} Engineering,OU=Groups,DC=corp,DC=example,DC=com`,
      ]),
      encryptFor,
    });

  return { certificate: idp.certificate, signedResponse };
};
