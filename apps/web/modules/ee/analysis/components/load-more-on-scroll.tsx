"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface LoadMoreOnScrollProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

/**
 * The end of a paged list: fetches the next page as it scrolls into view, and stays a real button for
 * keyboard users and for a page too short to scroll. Renders nothing once the list is complete.
 */
export const LoadMoreOnScroll = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: Readonly<LoadMoreOnScrollProps>) => {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) fetchNextPage();
      },
      // Start loading a little before the end comes into view, so scrolling rarely meets the spinner.
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      <Button variant="secondary" size="sm" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
        {t("common.load_more")}
      </Button>
    </div>
  );
};
