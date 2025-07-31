"use client";

import { useTranslate } from "@tolgee/react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { logger } from "@formbricks/logger";
import { BadgeContent } from "./components/badge-content";

interface IdBadgeProps {
  id: string | number;
  copyDisabled?: boolean;
  showCopyIconOnHover?: boolean;
  className?: string;
  label?: string;
  variant?: "row" | "column";
}

export const IdBadge: React.FC<IdBadgeProps> = ({
  id,
  copyDisabled = false,
  showCopyIconOnHover = false,
  className,
  label,
  variant = "row",
}) => {
  const { t } = useTranslate();
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(String(id));
      } else {
        logger.error("Clipboard API not supported");
        throw new Error("Clipboard API not supported");
      }
      toast.success(t("common.copied_to_clipboard"));
      setIsCopied(true);
    } catch (error) {
      logger.error(error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  // Add cooldown for copied state (5 seconds)
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const shouldShowIcon = showCopyIconOnHover ? isHovered : !copyDisabled;
  const isCopyEnabled = showCopyIconOnHover || !copyDisabled;

  if (!label) {
    return (
      <BadgeContent
        id={id}
        isCopyEnabled={isCopyEnabled}
        handleCopy={handleCopy}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        shouldShowIcon={shouldShowIcon}
        isCopied={isCopied}
        className={className}
      />
    );
  }

  if (variant === "column") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="font-regular text-xs text-slate-700">{label}</span>
        <BadgeContent
          id={id}
          isCopyEnabled={isCopyEnabled}
          handleCopy={handleCopy}
          isHovered={isHovered}
          setIsHovered={setIsHovered}
          shouldShowIcon={shouldShowIcon}
          isCopied={isCopied}
          className={className}
        />
      </div>
    );
  }

  // Row variant (default)
  return (
    <div className="flex items-center gap-2">
      <span className="font-regular text-xs text-slate-700">{label}</span>
      <BadgeContent
        id={id}
        isCopyEnabled={isCopyEnabled}
        handleCopy={handleCopy}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        shouldShowIcon={shouldShowIcon}
        isCopied={isCopied}
        className={className}
      />
    </div>
  );
};
