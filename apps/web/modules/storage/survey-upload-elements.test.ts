import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyFileUploadElement, TSurveySignatureElement } from "@formbricks/types/surveys/elements";
import {
  getSurveyUploadElementConfigs,
  getUploadElementAllowedExtensions,
  getUploadElementKind,
} from "./survey-upload-elements";

describe("survey upload elements", () => {
  describe("getUploadElementKind", () => {
    test.each(["fileUpload", "signature"])("is defined for %s", (type) => {
      expect(getUploadElementKind(type)).toBeDefined();
    });

    // Own-property lookup, not `in` or a plain index: an element type is data from the survey JSON, and
    // an inherited key must never read as an upload element.
    test.each(["constructor", "__proto__", "toString", "hasOwnProperty", "", "Signature"])(
      "is undefined for %j",
      (type) => {
        expect(getUploadElementKind(type)).toBeUndefined();
      }
    );
  });

  describe("getSurveyUploadElementConfigs", () => {
    test("ignores an element typed after an inherited object key", () => {
      const blocks = [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            { id: "weird", type: "constructor" },
            { id: "proto", type: "__proto__" },
            { id: "sig1", type: "signature" },
          ],
        },
      ] as unknown as TSurveyBlock[];

      expect(getSurveyUploadElementConfigs({ blocks }).map((element) => element.id)).toEqual(["sig1"]);
      expect(getSurveyUploadElementConfigs({ questions: [{ id: "weird", type: "constructor" }] })).toEqual(
        []
      );
    });
  });

  describe("getUploadElementAllowedExtensions", () => {
    test("is the fixed png for a Signature element, whatever else the element holds", () => {
      const signature = { id: "sig1", type: "signature" } as TSurveySignatureElement;
      const withStrayConfig = {
        ...signature,
        allowedFileExtensions: ["pdf"],
      } as unknown as TSurveySignatureElement;

      expect(getUploadElementAllowedExtensions(signature)).toEqual(["png"]);
      expect(getUploadElementAllowedExtensions(withStrayConfig)).toEqual(["png"]);
    });

    test("is the element's own allowedFileExtensions for a File upload element", () => {
      const fileUpload = {
        id: "file1",
        type: "fileUpload",
        allowedFileExtensions: ["pdf", "docx"],
      } as TSurveyFileUploadElement;

      expect(getUploadElementAllowedExtensions(fileUpload)).toEqual(["pdf", "docx"]);
    });

    test("is undefined for a File upload element with no restriction", () => {
      const fileUpload = { id: "file1", type: "fileUpload" } as TSurveyFileUploadElement;

      expect(getUploadElementAllowedExtensions(fileUpload)).toBeUndefined();
    });
  });
});
