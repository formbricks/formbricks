import { describe, expect, test } from "vitest";
import type { FeedbackRecordData } from "@/modules/hub/types";
import {
  serializeV3FeedbackDataset,
  serializeV3FeedbackRecord,
  serializeV3FeedbackRecordMatch,
} from "./serializers";

/**
 * The serializer is an explicit allowlist, so the risk it carries is *silent omission*: dropping a field
 * still returns a valid-looking record. These tests pin the whole field set, not a sample.
 */
const fullRecord: FeedbackRecordData = {
  id: "019fa338-f494-7384-b34e-01739783d280",
  tenant_id: "clfd1234567890123456789012",
  submission_id: "sub-1",
  source_type: "survey",
  source_id: "svy_1",
  source_name: "Q1 NPS",
  field_id: "q1",
  field_type: "text",
  field_label: "What can we improve?",
  field_group_id: "grp_1",
  field_group_label: "Group",
  user_id: "user-1",
  language: "en",
  value_text: "Great support",
  value_number: 9,
  value_boolean: true,
  value_date: "2026-07-01T00:00:00.000Z",
  value_id: "opt_1",
  metadata: { device: "ios" },
  sentiment: "positive",
  sentiment_score: 0.8,
  emotions: ["joy"],
  translation_lang_key: "de-DE",
  value_text_translated: "Guter Support",
  collected_at: "2026-07-01T00:00:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
} as FeedbackRecordData;

describe("serializeV3FeedbackRecord", () => {
  test("emits every allowlisted field, with the tenant renamed to dataset_id", () => {
    // Asserted as a whole object: a dropped field or a leaked extra both fail here.
    expect(serializeV3FeedbackRecord(fullRecord)).toEqual({
      id: fullRecord.id,
      dataset_id: "clfd1234567890123456789012",
      submission_id: "sub-1",
      source_type: "survey",
      source_id: "svy_1",
      source_name: "Q1 NPS",
      field_id: "q1",
      field_type: "text",
      field_label: "What can we improve?",
      field_group_id: "grp_1",
      field_group_label: "Group",
      user_id: "user-1",
      language: "en",
      value_text: "Great support",
      value_number: 9,
      value_boolean: true,
      value_date: "2026-07-01T00:00:00.000Z",
      value_id: "opt_1",
      metadata: { device: "ios" },
      sentiment: "positive",
      sentiment_score: 0.8,
      emotions: ["joy"],
      translation_lang_key: "de-DE",
      value_text_translated: "Guter Support",
      collected_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
  });

  test("never emits tenant_id", () => {
    const dto = serializeV3FeedbackRecord(fullRecord);

    expect(dto).not.toHaveProperty("tenant_id");
    expect(JSON.stringify(dto)).not.toContain("tenant_id");
  });

  test("drops anything outside the allowlist, so an SDK addition can't widen the response", () => {
    const withExtras = {
      ...fullRecord,
      internal_debug_note: "should not surface",
      hub_only_column: 42,
    } as unknown as FeedbackRecordData;

    const dto = serializeV3FeedbackRecord(withExtras) as Record<string, unknown>;

    expect(dto.internal_debug_note).toBeUndefined();
    expect(dto.hub_only_column).toBeUndefined();
  });

  test("omits absent fields rather than emitting undefined, and preserves explicit nulls", () => {
    const sparse = {
      id: fullRecord.id,
      tenant_id: "clfd1234567890123456789012",
      value_text: null,
    } as unknown as FeedbackRecordData;

    const dto = serializeV3FeedbackRecord(sparse);

    expect(dto).toEqual({ id: fullRecord.id, dataset_id: "clfd1234567890123456789012", value_text: null });
    expect(Object.keys(dto)).not.toContain("submission_id");
  });

  test("omits dataset_id when the Hub record carries no tenant", () => {
    const orphan = { id: fullRecord.id } as unknown as FeedbackRecordData;

    expect(serializeV3FeedbackRecord(orphan)).toEqual({ id: fullRecord.id });
  });
});

describe("serializeV3FeedbackRecordMatch", () => {
  test("emits exactly the four match fields", () => {
    const match = {
      feedback_record_id: "019fa338-f494-7384-b34e-01739783d280",
      score: 0.8123,
      field_label: "What can we improve?",
      value_text: "payment step was unclear",
    };

    expect(serializeV3FeedbackRecordMatch(match)).toEqual(match);
  });

  test("drops anything the Hub adds beyond the match contract", () => {
    const withExtras = {
      feedback_record_id: "019fa338-f494-7384-b34e-01739783d280",
      score: 0.5,
      field_label: "Q",
      value_text: "text",
      distance: 0.5,
      tenant_id: "clfd1234567890123456789012",
    } as unknown as Parameters<typeof serializeV3FeedbackRecordMatch>[0];

    const dto = serializeV3FeedbackRecordMatch(withExtras) as Record<string, unknown>;

    expect(dto.distance).toBeUndefined();
    expect(dto.tenant_id).toBeUndefined();
    expect(Object.keys(dto)).toEqual(["feedback_record_id", "score", "field_label", "value_text"]);
  });
});

describe("serializeV3FeedbackDataset", () => {
  test("returns only id and name", () => {
    const dataset = { id: "clfd1234567890123456789012", name: "Support", organizationId: "org_1" };

    expect(serializeV3FeedbackDataset(dataset)).toEqual({
      id: "clfd1234567890123456789012",
      name: "Support",
    });
  });
});
