import { describe, expect, test } from "vitest";
import type { TaxonomyFieldOption } from "@/modules/hub/types";
import { computeGate, pendingEmbeddingsForFields } from "./gate";

const field = (recordCount: number, embeddingCount: number): TaxonomyFieldOption => ({
  tenant_id: "d",
  source_type: "survey",
  source_id: "s",
  field_id: "q1",
  record_count: recordCount,
  embedding_count: embeddingCount,
});

const ready = { hasDirectories: true, isLoading: false, isError: false, unavailable: false };

describe("computeGate", () => {
  test("insufficient when total open-text records < 750", () => {
    const result = computeGate({ ...ready, fields: [field(700, 700)] });
    expect(result.gateVariant).toBe("insufficient");
    expect(result.totalOpenTextRecords).toBe(700);
  });

  test("hard embedding gate when pending > 50", () => {
    const result = computeGate({ ...ready, fields: [field(1000, 900)] });
    expect(result.gateVariant).toBe("embedding");
    expect(result.pendingEmbeddings).toBe(100);
  });

  test("pending == 50 is the soft band (inline progress, no hard gate)", () => {
    const result = computeGate({ ...ready, fields: [field(1000, 950)] });
    expect(result.gateVariant).toBeNull();
    expect(result.showInlineProgress).toBe(true);
  });

  test("pending == 51 hard-gates", () => {
    expect(computeGate({ ...ready, fields: [field(1000, 949)] }).gateVariant).toBe("embedding");
  });

  test("no gate and no inline progress when fully embedded", () => {
    const result = computeGate({ ...ready, fields: [field(1000, 1000)] });
    expect(result.gateVariant).toBeNull();
    expect(result.showInlineProgress).toBe(false);
  });

  test("does not evaluate the gate while loading / error / unavailable / no directory", () => {
    const withField = [field(10, 0)];
    expect(computeGate({ ...ready, isLoading: true, fields: withField }).gateVariant).toBeNull();
    expect(computeGate({ ...ready, isError: true, fields: withField }).gateVariant).toBeNull();
    expect(computeGate({ ...ready, unavailable: true, fields: withField }).gateVariant).toBeNull();
    expect(computeGate({ ...ready, hasDirectories: false, fields: withField }).gateVariant).toBeNull();
  });

  test("sums per-field counts across fields without double counting", () => {
    const result = computeGate({ ...ready, fields: [field(400, 400), field(400, 380)] });
    expect(result.totalOpenTextRecords).toBe(800);
    expect(result.totalEmbeddedRecords).toBe(780);
    expect(result.pendingEmbeddings).toBe(20);
  });
});

describe("pendingEmbeddingsForFields", () => {
  test("never returns a negative pending count", () => {
    expect(pendingEmbeddingsForFields([field(100, 120)])).toBe(0);
  });
});
