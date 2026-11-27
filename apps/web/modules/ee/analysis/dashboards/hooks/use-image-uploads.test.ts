/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { useImageUploads } from "./use-image-uploads";

const imageBlock = (id: string): TDashboardWidget =>
  ({
    id,
    kind: "image",
    chartId: null,
    dashboardId: "d",
    pageId: "p1",
    layout: { x: 0, y: 0, w: 4, h: 4 },
    order: 0,
    content: { fileUrl: null, fit: "fit", alt: "" },
  }) as unknown as TDashboardWidget;

const setup = ({ editSession, saving = false }: { editSession?: number | null; saving?: boolean } = {}) => {
  const savingRef = { current: saving };
  const editSessionRef: { current: number | null } = { current: editSession === undefined ? 1 : editSession };
  const hook = renderHook(() => {
    const [draft, setDraft] = useState<TDashboardWidget[] | null>([imageBlock("img")]);
    const uploads = useImageUploads({ savingRef, editSessionRef, setDraftWidgets: setDraft });
    return { draft, ...uploads };
  });
  return { ...hook, savingRef, editSessionRef };
};

const fileUrlOf = (draft: TDashboardWidget[] | null) =>
  (draft?.[0] as { content: { fileUrl: string | null } } | undefined)?.content.fileUrl;

describe("useImageUploads", () => {
  test("puts the uploaded file into the draft and releases Save", () => {
    const { result } = setup();
    let ticket: ReturnType<typeof result.current.handleImageUploadStart> = null;
    act(() => {
      ticket = result.current.handleImageUploadStart("img");
    });
    expect(ticket).not.toBeNull();
    expect(result.current.isUploading).toBe(true);
    expect(result.current.uploadsRef.current).toBe(1);

    act(() => result.current.handleImageUploadEnd(ticket!, "https://files/img.png"));
    expect(result.current.isUploading).toBe(false);
    expect(fileUrlOf(result.current.draft)).toBe("https://files/img.png");
  });

  test("starts no upload while saving or outside an edit session", () => {
    expect(setup({ saving: true }).result.current.handleImageUploadStart("img")).toBeNull();
    expect(setup({ editSession: null }).result.current.handleImageUploadStart("img")).toBeNull();
  });

  test("drops a file whose edit session has ended, but still releases Save", () => {
    const { result, editSessionRef } = setup();
    let ticket: ReturnType<typeof result.current.handleImageUploadStart> = null;
    act(() => {
      ticket = result.current.handleImageUploadStart("img");
    });
    editSessionRef.current = 2;
    act(() => result.current.handleImageUploadEnd(ticket!, "https://files/img.png"));
    expect(result.current.isUploading).toBe(false);
    expect(fileUrlOf(result.current.draft)).toBeNull();
  });

  test("applies only the block's latest upload", () => {
    const { result } = setup();
    let first: ReturnType<typeof result.current.handleImageUploadStart> = null;
    let second: ReturnType<typeof result.current.handleImageUploadStart> = null;
    act(() => {
      first = result.current.handleImageUploadStart("img");
      second = result.current.handleImageUploadStart("img");
    });
    act(() => result.current.handleImageUploadEnd(first!, "https://files/old.png"));
    expect(result.current.isUploading).toBe(true);
    expect(fileUrlOf(result.current.draft)).toBeNull();
    act(() => result.current.handleImageUploadEnd(second!, "https://files/new.png"));
    expect(fileUrlOf(result.current.draft)).toBe("https://files/new.png");
  });
});
