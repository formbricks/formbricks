import { describe, expect, test } from "vitest";
import {
  SAML_PARSE_QUEUE_LIMIT,
  SAML_PARSE_TIME_BUDGET_MS,
  probeSamlResponseParse,
} from "./saml-parse-budget";
import { SAML_RESPONSE_MARKUP_BUDGET, checkSamlResponseBounds } from "./saml-response-bounds";
import {
  ENCRYPTED_RESPONSE_ISSUER,
  createSpKeyPair,
  encryptAssertion,
  flatAssertion,
  nestedNamespaceAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "./tests/encrypted-saml-response";

// A real worker thread runs here, not a mock: what is under test is that a slow parse is cut off and the pool
// recovers, which only the real worker can show.

const b64 = (xml: string) => Buffer.from(xml).toString("base64");

/** For the unencrypted responses, which never need it; the encrypted ones below use a real key pair. */
const KEY = "unused-sp-key";

const RESPONSE =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp1" InResponseTo="_req1">' +
  '<saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml2:Issuer>' +
  "</samlp:Response>";

/**
 * Nested namespace scopes: xmldom chains each onto its parent, so lookups cost the square of the depth. 8,000
 * levels take ~0.8 s to parse, far past the budget, which is exactly what this gate exists to cut off.
 */
const SLOW = Array.from({ length: 8000 }, (_, i) => `<a xmlns:p${i}="u">`).join("");

describe("probeSamlResponseParse", () => {
  test("parses a real response within the budget and reads only its identifiers", async () => {
    const probe = await probeSamlResponseParse(b64(RESPONSE), KEY);

    expect(probe).toEqual({
      outcome: "parsed",
      ms: expect.any(Number),
      claims: { issuer: "https://idp.example.com", id: "_resp1", inResponseTo: "_req1" },
    });
  });

  test("cuts off a parse that runs past the budget, then parses the next response on a fresh worker", async () => {
    const started = performance.now();
    const slow = await probeSamlResponseParse(b64(SLOW), KEY);
    const elapsed = performance.now() - started;

    expect(slow).toEqual({ outcome: "too_costly", reason: "time" });
    // Stopped at the budget, not after the ~0.8 s the parse would have taken.
    expect(elapsed).toBeLessThan(SAML_PARSE_TIME_BUDGET_MS + 400);

    await expect(probeSamlResponseParse(b64(RESPONSE), KEY)).resolves.toMatchObject({ outcome: "parsed" });
  });

  test("returns no claims for malformed input, without failing", async () => {
    await expect(probeSamlResponseParse(b64("<a><b></a>"), KEY)).resolves.toMatchObject({
      outcome: "parsed",
      claims: {},
    });
    await expect(probeSamlResponseParse("%%% not base64 %%%", KEY)).resolves.toMatchObject({
      outcome: "parsed",
    });
  });

  test("refuses at once when the queue is full, and serves everything it accepted", async () => {
    // One job runs while the rest wait; the queue holds SAML_PARSE_QUEUE_LIMIT more.
    const accepted = Array.from({ length: SAML_PARSE_QUEUE_LIMIT + 1 }, () =>
      probeSamlResponseParse(b64(RESPONSE), KEY)
    );
    const overflow = await probeSamlResponseParse(b64(RESPONSE), KEY);

    expect(overflow).toEqual({ outcome: "busy" });
    for (const probe of await Promise.all(accepted)) expect(probe.outcome).toBe("parsed");
  });

  describe("encrypted assertions (ENG-4051)", () => {
    const sp = createSpKeyPair();
    const encrypted = (assertion: string, publicKey = sp.publicKey) =>
      b64(samlResponseWith(encryptAssertion(assertion, publicKey)));

    test("decrypts and parses a signed assertion of 150 groups within the budget", async () => {
      await expect(
        probeSamlResponseParse(encrypted(signedAssertionWithGroups(150)), sp.privateKey)
      ).resolves.toEqual({
        outcome: "parsed",
        ms: expect.any(Number),
        claims: { issuer: ENCRYPTED_RESPONSE_ISSUER, id: "_resp1", inResponseTo: "_req1" },
      });
    });

    test("cuts off a plaintext too costly to parse, which the byte bounds pass as ciphertext", async () => {
      const response = encrypted(nestedNamespaceAssertion(4000));
      // The gap this closes: the bounds see only base64 ciphertext, and the outer document is cheap.
      expect(checkSamlResponseBounds(response)).toBeNull();

      const started = performance.now();
      const probe = await probeSamlResponseParse(response, sp.privateKey);

      expect(probe).toEqual({ outcome: "too_costly", reason: "time" });
      expect(performance.now() - started).toBeLessThan(SAML_PARSE_TIME_BUDGET_MS + 400);
    });

    test("refuses a decrypted assertion carrying more markup than the bounds allow", async () => {
      const response = encrypted(flatAssertion(SAML_RESPONSE_MARKUP_BUDGET + 1_000));
      expect(checkSamlResponseBounds(response)).toBeNull();

      // It parses in ~15 ms, so the markup bound refuses it; on a loaded machine the time budget may get there
      // first. The worker's measure is checked exactly in saml-parse-worker.test.ts.
      const probe = await probeSamlResponseParse(response, sp.privateKey);
      expect(["refused", "too_costly"]).toContain(probe.outcome);
    });

    test("hands an assertion encrypted to another key on to jackson, which fails it alike", async () => {
      const other = createSpKeyPair();

      await expect(
        probeSamlResponseParse(encrypted(nestedNamespaceAssertion(4000), other.publicKey), sp.privateKey)
      ).resolves.toMatchObject({ outcome: "parsed", claims: { issuer: ENCRYPTED_RESPONSE_ISSUER } });
    });
  });
});
