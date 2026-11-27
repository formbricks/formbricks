"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { TDashboardPage } from "@/modules/ee/analysis/types/analysis";
import { resolveSelectedPageId } from "../lib/dashboard-draft";

/** The query parameter the selected page is kept in, so a link opens the same page. */
const PAGE_PARAM = "page";

/** The selected page, kept in the URL. */
export const useDashboardPageSelection = (pages: TDashboardPage[]) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedPageId = resolveSelectedPageId(pages, searchParams.get(PAGE_PARAM));
  const selectPage = useCallback(
    (pageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(PAGE_PARAM, pageId);
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    },
    [pathname, searchParams]
  );

  // The selection and pages as they are now, for work that finishes after the render that started it.
  const selectedPageIdRef = useRef(selectedPageId);
  const pagesRef = useRef(pages);
  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
    pagesRef.current = pages;
  }, [selectedPageId, pages]);

  return { selectedPageId, selectPage, selectedPageIdRef, pagesRef };
};
