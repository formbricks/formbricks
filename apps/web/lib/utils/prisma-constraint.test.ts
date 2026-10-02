import { describe, expect, test } from "vitest";
import { Prisma, type PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { getUniqueConstraintFields, isUniqueConstraintError } from "./prisma-constraint";

const knownError = (code: string, meta?: Record<string, unknown>): PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta });

// The shape Prisma 7 + @prisma/adapter-pg actually produces (verified against a real P2002): no
// top-level `target`; the columns are nested under driverAdapterError.cause.constraint.fields.
const adapterP2002 = (fields: string[]): PrismaClientKnownRequestError =>
  knownError("P2002", {
    modelName: "User",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        kind: "UniqueConstraintViolation",
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "User_${fields.join("_")}_key"`,
        constraint: { fields },
      },
    },
  });

// The shape @prisma/adapter-pg 7.10+ produces (verified against a real P2002, prisma#29587): the
// constraint name and table instead of the column list.
const indexP2002 = (index: string, table?: string): PrismaClientKnownRequestError =>
  knownError("P2002", {
    modelName: table,
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        kind: "UniqueConstraintViolation",
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "${index}"`,
        constraint: { index },
        ...(table !== undefined && { table }),
      },
    },
  });

// The legacy / library-engine shape (top-level target). Still supported as a fallback.
const legacyP2002 = (target: string[]): PrismaClientKnownRequestError => knownError("P2002", { target });

describe("isUniqueConstraintError", () => {
  test("is true only for P2002", () => {
    expect(isUniqueConstraintError(adapterP2002(["email"]))).toBe(true);
    expect(isUniqueConstraintError(knownError("P2025"))).toBe(false);
    expect(isUniqueConstraintError(new Error("plain"))).toBe(false);
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

describe("getUniqueConstraintFields", () => {
  test("extracts columns from the Prisma 7 driver-adapter shape (no meta.target)", () => {
    expect(adapterP2002(["email"]).meta?.target).toBeUndefined(); // guards the premise of the bug
    expect(getUniqueConstraintFields(adapterP2002(["email"]))).toEqual(["email"]);
    expect(getUniqueConstraintFields(adapterP2002(["responseId", "tagId"]))).toEqual(["responseId", "tagId"]);
  });

  describe("adapter-pg 7.10+ shape (constraint name instead of columns)", () => {
    test("parses Prisma's default `${table}_${columns}_key` name, preserving column order", () => {
      expect(getUniqueConstraintFields(indexP2002("User_email_key", "User"))).toEqual(["email"]);
      expect(getUniqueConstraintFields(indexP2002("Response_surveyId_singleUseId_key", "Response"))).toEqual([
        "surveyId",
        "singleUseId",
      ]);
      // ActionClass callers read fields[0].
      expect(
        getUniqueConstraintFields(indexP2002("ActionClass_name_workspaceId_key", "ActionClass"))[0]
      ).toBe("name");
    });

    test("resolves names the default rule cannot round-trip from the explicit map", () => {
      expect(getUniqueConstraintFields(indexP2002("TagsOnResponses_pkey", "TagsOnResponses"))).toEqual([
        "responseId",
        "tagId",
      ]);
      expect(
        getUniqueConstraintFields(indexP2002("PasswordResetToken_token_hash_key", "PasswordResetToken"))
      ).toEqual(["token_hash"]);
      expect(
        getUniqueConstraintFields(
          indexP2002(
            "FeedbackSourceFieldMapping_workspaceId_feedbackSourceId_sourceF",
            "FeedbackSourceFieldMapping"
          )
        )
      ).toEqual(["workspaceId", "feedback_source_id", "source_field_id", "target_field_id"]);
    });

    test("maps a single-column primary key to id", () => {
      expect(getUniqueConstraintFields(indexP2002("Survey_pkey", "Survey"))).toEqual(["id"]);
    });

    test("returns [] for a name it cannot attribute to the reported table", () => {
      expect(getUniqueConstraintFields(indexP2002("some_custom_index", "User"))).toEqual([]);
      expect(getUniqueConstraintFields(indexP2002("Other_email_key", "User"))).toEqual([]);
      expect(getUniqueConstraintFields(indexP2002("User__key", "User"))).toEqual([]);
      expect(getUniqueConstraintFields(indexP2002("User_a__b_key", "User"))).toEqual([]);
      // A name colliding with an Object.prototype member must not resolve through the prototype.
      expect(getUniqueConstraintFields(indexP2002("constructor", "User"))).toEqual([]);
      expect(getUniqueConstraintFields(indexP2002("__proto__", "User"))).toEqual([]);
      // Without a table only the explicit map can resolve a name.
      expect(getUniqueConstraintFields(indexP2002("User_email_key"))).toEqual([]);
      expect(getUniqueConstraintFields(indexP2002("TagsOnResponses_pkey"))).toEqual(["responseId", "tagId"]);
    });

    test("returns a copy, so a caller cannot mutate the map", () => {
      const fields = getUniqueConstraintFields(indexP2002("TagsOnResponses_pkey", "TagsOnResponses"));
      fields.push("mutated");
      expect(getUniqueConstraintFields(indexP2002("TagsOnResponses_pkey", "TagsOnResponses"))).toEqual([
        "responseId",
        "tagId",
      ]);
    });
  });

  test("extracts columns from the legacy top-level meta.target shape", () => {
    expect(getUniqueConstraintFields(legacyP2002(["email"]))).toEqual(["email"]);
  });

  test("returns [] when neither shape is present (callers must still map to conflict, not 500)", () => {
    expect(getUniqueConstraintFields(knownError("P2002"))).toEqual([]);
    expect(getUniqueConstraintFields(knownError("P2002", { modelName: "User" }))).toEqual([]);
  });

  test("filters out non-string entries defensively", () => {
    expect(getUniqueConstraintFields(legacyP2002(["email", null as unknown as string]))).toEqual(["email"]);
  });

  // The adapter regex-scrapes the Postgres DETAIL, which quotes every identifier that isn't
  // all-lowercase. Before this was handled, `includes("singleUseId")` never matched `'"singleUseId"'`
  // and duplicate single-use responses fell through to a 500 instead of a 409 (ENG-2174).
  describe("quoted identifiers (Postgres quote_identifier)", () => {
    test("unquotes a fully quoted composite key", () => {
      expect(getUniqueConstraintFields(adapterP2002(['"surveyId"', '"singleUseId"']))).toEqual([
        "surveyId",
        "singleUseId",
      ]);
    });

    test("unquotes a single quoted column", () => {
      expect(getUniqueConstraintFields(adapterP2002(['"displayId"']))).toEqual(["displayId"]);
    });

    test("handles a mixed list, leaving the bare lowercase column untouched", () => {
      // ActionClass_name_workspaceId_key — callers that read fields[0] must be unaffected.
      const fields = getUniqueConstraintFields(adapterP2002(["name", '"workspaceId"']));
      expect(fields).toEqual(["name", "workspaceId"]);
      expect(fields[0]).toBe("name");
    });

    test("leaves @map()ed snake_case columns unchanged (Postgres never quotes them)", () => {
      expect(getUniqueConstraintFields(adapterP2002(["token_hash"]))).toEqual(["token_hash"]);
    });

    test("normalises the legacy shape too, so both shapes stay interchangeable", () => {
      expect(getUniqueConstraintFields(legacyP2002(['"email"']))).toEqual(["email"]);
      expect(getUniqueConstraintFields(legacyP2002(["email"]))).toEqual(["email"]);
    });

    test("only strips a matched outer pair", () => {
      // A lone quote is not a pair; an inner quote is part of the identifier.
      expect(getUniqueConstraintFields(adapterP2002(['"']))).toEqual(['"']);
      expect(getUniqueConstraintFields(adapterP2002(['""']))).toEqual([""]);
      expect(getUniqueConstraintFields(adapterP2002(['"a"b"']))).toEqual(['a"b']);
    });

    test("is idempotent — an already-bare name survives a second pass", () => {
      const once = getUniqueConstraintFields(adapterP2002(['"surveyId"']));
      expect(getUniqueConstraintFields(adapterP2002(once))).toEqual(once);
    });
  });
});
