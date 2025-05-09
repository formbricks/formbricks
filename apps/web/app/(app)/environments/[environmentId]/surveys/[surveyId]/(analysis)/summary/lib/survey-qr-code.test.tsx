import { act, cleanup, renderHook } from "@testing-library/react";
import QRCodeStyling from "qr-code-styling";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSurveyQRCode } from "./survey-qr-code";

// Mock QRCodeStyling
const mockUpdate = vi.fn();
const mockAppend = vi.fn();
const mockDownload = vi.fn();
vi.mock("qr-code-styling", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      update: mockUpdate,
      append: mockAppend,
      download: mockDownload,
    })),
  };
});

describe("useSurveyQRCode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset the DOM element for qrCodeRef before each test
    if (document.body.querySelector("#qr-code-test-div")) {
      document.body.removeChild(document.body.querySelector("#qr-code-test-div")!);
    }
    const div = document.createElement("div");
    div.id = "qr-code-test-div";
    document.body.appendChild(div);
  });

  test("should call toast.error if QRCodeStyling instantiation fails", () => {
    vi.mocked(QRCodeStyling).mockImplementationOnce(() => {
      throw new Error("QR Init failed");
    });
    renderHook(() => useSurveyQRCode("https://example.com/survey-error"));
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.summary.failed_to_generate_qr_code");
  });

  test("should call toast.error if QRCodeStyling update fails", () => {
    mockUpdate.mockImplementationOnce(() => {
      throw new Error("QR Update failed");
    });
    renderHook(() => useSurveyQRCode("https://example.com/survey-update-error"));
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.summary.failed_to_generate_qr_code");
  });

  test("should call toast.error if QRCodeStyling append fails", () => {
    mockAppend.mockImplementationOnce(() => {
      throw new Error("QR Append failed");
    });
    const { result } = renderHook(() => useSurveyQRCode("https://example.com/survey-append-error"));
    // Need to manually assign a div for the ref to trigger the append error path
    act(() => {
      result.current.qrCodeRef.current = document.createElement("div");
    });
    // Rerender to trigger useEffect after ref is set
    renderHook(() => useSurveyQRCode("https://example.com/survey-append-error"), { initialProps: result });

    expect(toast.error).toHaveBeenCalledWith("environments.surveys.summary.failed_to_generate_qr_code");
  });

  test("should call toast.error if download fails", () => {
    const surveyUrl = "https://example.com/survey-download-error";
    const { result } = renderHook(() => useSurveyQRCode(surveyUrl));
    vi.mocked(QRCodeStyling).mockImplementationOnce(
      () =>
        ({
          update: vi.fn(),
          append: vi.fn(),
          download: vi.fn(() => {
            throw new Error("Download failed");
          }),
        }) as any
    );

    act(() => {
      result.current.downloadQRCode();
    });
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.summary.failed_to_generate_qr_code");
  });

  test("should not create new QRCodeStyling instance if one already exists for display", () => {
    const surveyUrl = "https://example.com/survey1";
    const { rerender } = renderHook(() => useSurveyQRCode(surveyUrl));
    expect(QRCodeStyling).toHaveBeenCalledTimes(1);

    rerender(); // Rerender with same props
    expect(QRCodeStyling).toHaveBeenCalledTimes(1); // Should not create a new instance
  });
});
