import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyFileUploadElement, TSurveySignatureElement } from "@formbricks/types/surveys/elements";
import {
  createEmptyUploadElementIds,
  getSurveyUploadElementConfigs,
  getSurveyUploadElementMaxFileSize,
  getUploadElementAllowedExtensions,
  getUploadElementKind,
  mapUploadElementTypes,
  uploadElementKinds,
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

  describe("per-kind upload limits", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          { id: "sig", type: "signature" },
          { id: "file", type: "fileUpload" },
          { id: "text", type: "openText" },
        ],
      },
    ] as unknown as TSurveyBlock[];

    test("a Signature is capped at 1 MB and a File upload sets no cap of its own", () => {
      expect(uploadElementKinds.signature.maxFileSizeBytes).toBe(1024 * 1024);
      expect(getSurveyUploadElementMaxFileSize({ elementId: "sig", blocks })).toBe(1024 * 1024);
      expect(getSurveyUploadElementMaxFileSize({ elementId: "file", blocks })).toBeUndefined();
    });

    test("is undefined for an element that is not an upload element or does not exist", () => {
      expect(getSurveyUploadElementMaxFileSize({ elementId: "text", blocks })).toBeUndefined();
      expect(getSurveyUploadElementMaxFileSize({ elementId: "nope", blocks })).toBeUndefined();
    });

    test("reads a legacy question too", () => {
      expect(
        getSurveyUploadElementMaxFileSize({ elementId: "q", questions: [{ id: "q", type: "signature" }] })
      ).toBe(1024 * 1024);
    });
  });

  describe("the Signature file name pattern", () => {
    const { fileNamePattern } = uploadElementKinds.signature;

    test("matches exactly what the upload route stores for signature.png", () => {
      expect(fileNamePattern.test("signature--fid--0b8a4a3e-1111-4222-8333-444455556666.png")).toBe(true);
    });

    test.each([
      "signature.png",
      "signature--fid--abc.png",
      "photo--fid--0b8a4a3e-1111-4222-8333-444455556666.png",
      "signature--fid--0b8a4a3e-1111-4222-8333-444455556666.png.png",
      "signature--fid--0b8a4a3e-1111-4222-8333-444455556666.jpg",
      "../signature--fid--0b8a4a3e-1111-4222-8333-444455556666.png",
      "signature--fid--0B8A4A3E-1111-4222-8333-444455556666.png",
    ])("refuses %s", (name) => {
      expect(fileNamePattern.test(name)).toBe(false);
    });
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

  describe("mapUploadElementTypes", () => {
    test("builds one value per upload element type, from the descriptor's keys", () => {
      const built = mapUploadElementTypes((type) => `${type}!`);

      expect(Object.keys(built).sort()).toEqual(Object.keys(uploadElementKinds).sort());
      expect(built).toEqual({ fileUpload: "fileUpload!", signature: "signature!" });
    });
  });

  describe("createEmptyUploadElementIds", () => {
    test("has an empty set for every upload element type", () => {
      expect(createEmptyUploadElementIds()).toEqual({
        fileUpload: new Set(),
        signature: new Set(),
      });
    });

    test("hands out fresh sets on every call", () => {
      const first = createEmptyUploadElementIds();
      const second = createEmptyUploadElementIds();

      expect(first.fileUpload).not.toBe(second.fileUpload);
      expect(first.signature).not.toBe(second.signature);
    });
  });
});
