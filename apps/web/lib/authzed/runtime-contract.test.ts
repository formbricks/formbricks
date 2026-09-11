import { describe, expect, test } from "vitest";
import runtimeContract from "../../../../authzed/runtime-contract.json";
import { AUTHZED_ACTIVATION_PROTOCOL_VERSION, AUTHZED_CLIENT_CONTRACT_VERSION } from "./activation-types";

describe("AuthZed runtime contract", () => {
  test("keeps the signed release contract aligned with the runtime compatibility gates", () => {
    expect(runtimeContract).toMatchObject({
      clientContractVersion: AUTHZED_CLIENT_CONTRACT_VERSION,
      protocolVersion: AUTHZED_ACTIVATION_PROTOCOL_VERSION,
    });
  });
});
