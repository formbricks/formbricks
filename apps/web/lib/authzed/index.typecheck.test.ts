import "server-only";
import { expectTypeOf, test } from "vitest";
import { getAuthzedClient } from "./index";

test("keeps LookupResources out of the public AuthZed barrel", () => {
  type TPublicClientHasLookup = "lookupResources" extends keyof ReturnType<typeof getAuthzedClient>
    ? true
    : false;
  expectTypeOf<TPublicClientHasLookup>().toEqualTypeOf<false>();
});
