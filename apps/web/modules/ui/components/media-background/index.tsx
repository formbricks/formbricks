"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SurveyType } from "@formbricks/database/prisma-browser";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";

interface MediaBackgroundProps {
  children: React.ReactNode;
  styling: TSurveyStyling | TWorkspaceStyling;
  surveyType: SurveyType;
  isEditorView?: boolean;
  isMobilePreview?: boolean;
  ContentRef?: React.RefObject<HTMLDivElement> | null;
  onBackgroundLoaded?: (isLoaded: boolean) => void;
  useNaturalHeight?: boolean;
}

export const MediaBackground: React.FC<MediaBackgroundProps> = ({
  children,
  styling,
  surveyType,
  isEditorView = false,
  isMobilePreview = false,
  ContentRef,
  onBackgroundLoaded,
  useNaturalHeight = false,
}) => {
  const { t } = useTranslation();
  const animatedBackgroundRef = useRef<HTMLVideoElement>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [authorDetailsForUnsplash, setAuthorDetailsForUnsplash] = useState({ authorName: "", authorURL: "" });

  const background = styling.background;

  useEffect(() => {
    if (background?.bgType === "animation" && animatedBackgroundRef.current) {
      const video = animatedBackgroundRef.current;
      const onCanPlayThrough = () => setBackgroundLoaded(true);
      video.addEventListener("canplaythrough", onCanPlayThrough);
      video.src = background?.bg || "";

      // Cleanup
      return () => video.removeEventListener("canplaythrough", onCanPlayThrough);
    } else if ((background?.bgType === "image" || background?.bgType === "upload") && background?.bg) {
      if (background?.bgType === "image") {
        // To not set for Default Images as they have relative URL & are not from Unsplash
        if (!background?.bg.startsWith("/")) {
          setAuthorDetailsForUnsplash({
            authorName: new URL(background?.bg!).searchParams.get("authorName") || "",
            authorURL: new URL(background?.bg!).searchParams.get("authorLink") || "",
          });
        } else {
          setAuthorDetailsForUnsplash({ authorName: "", authorURL: "" });
        }
      }
    } else {
      // For colors or any other types, set to loaded immediately
      setBackgroundLoaded(true);
    }
  }, [background?.bg, background?.bgType]);

  useEffect(() => {
    if (backgroundLoaded && onBackgroundLoaded) {
      onBackgroundLoaded(true);
    }
  }, [backgroundLoaded, onBackgroundLoaded]);

  const baseClasses = "absolute inset-0 h-full w-full transition-opacity duration-500 bg-slate-200";
  const loadedClass = backgroundLoaded ? "opacity-100" : "opacity-0";

  const getFilterStyle = () => {
    return `brightness(${background?.brightness ?? 100}%)`;
  };

  const renderBackground = () => {
    const filterStyle = getFilterStyle();

    switch (background?.bgType) {
      case "color":
        return (
          <div
            className={`${baseClasses} ${loadedClass}`}
            style={{ backgroundColor: background?.bg || "#ffffff", filter: `${filterStyle}` }}
          />
        );
      case "animation":
        return (
          <video
            ref={animatedBackgroundRef}
            muted
            loop
            autoPlay
            playsInline
            className={`${baseClasses} ${loadedClass} object-cover`}
            style={{ filter: `${filterStyle}` }}>
            <source src={background?.bg || ""} type="video/mp4" />
          </video>
        );
      case "image":
        if (!background?.bg) {
          return <div>{t("common.no_background_image_found")}</div>;
        }

        return (
          <>
            <div className={`${baseClasses} ${loadedClass} bg-cover bg-center`}>
              <Image
                src={background?.bg}
                alt="Background image"
                layout="fill"
                objectFit="cover"
                style={{ filter: `${filterStyle}` }}
                onLoadingComplete={() => setBackgroundLoaded(true)}
              />
              {authorDetailsForUnsplash.authorName && (
                <div className="absolute bottom-4 right-6 z-10 ml-auto hidden w-max text-xs text-slate-400 md:block">
                  <span>{t("common.photo_by")}</span>
                  <Link
                    href={authorDetailsForUnsplash.authorURL + "?utm_source=formbricks&utm_medium=referral"}
                    target="_blank"
                    className="hover:underline">
                    {authorDetailsForUnsplash.authorName}
                  </Link>
                  <span> {t("common.on")} </span>
                  <Link
                    href="https://unsplash.com/?utm_source=formbricks&utm_medium=referral"
                    target="_blank"
                    className="hover:underline">
                    Unsplash
                  </Link>
                </div>
              )}
            </div>
          </>
        );
      case "upload":
        if (!background?.bg) {
          return <div>{t("common.no_background_image_found")}</div>;
        }
        return (
          <div className={`${baseClasses} ${loadedClass} bg-cover bg-center`}>
            <Image
              src={background?.bg}
              alt="Background image"
              layout="fill"
              objectFit="cover"
              style={{ filter: `${filterStyle}` }}
              onLoadingComplete={() => setBackgroundLoaded(true)}
            />
          </div>
        );
      default:
        return <div className={`${baseClasses} ${loadedClass}`} />;
    }
  };

  const renderContent = () => (
    <div
      className={cn(
        "no-scrollbar absolute flex h-full w-full overflow-hidden",
        useNaturalHeight
          ? "flex-col items-stretch overflow-hidden"
          : "items-center justify-center overflow-hidden"
      )}>
      {children}
    </div>
  );

  if (isMobilePreview) {
    return (
      <div
        ref={ContentRef}
        data-testid="mobile-preview-container"
        className={`relative h-[90%] w-full overflow-hidden rounded-[3rem] border-[6px] border-slate-400 lg:w-[75%] ${getFilterStyle()}`}>
        {/* below element is use to create notch for the mobile device mockup   */}
        <div className="absolute left-1/2 right-1/2 top-2 z-20 h-4 w-1/3 -translate-x-1/2 transform rounded-full bg-slate-400"></div>
        {surveyType === "link" && renderBackground()}
        {renderContent()}
      </div>
    );
  } else if (isEditorView) {
    return (
      <div
        ref={ContentRef}
        className={cn("flex flex-col rounded-b-lg", useNaturalHeight ? "min-h-0 flex-1" : "flex-grow")}>
        <div
          className={cn(
            "relative flex w-full flex-col",
            useNaturalHeight
              ? "min-h-0 flex-1 items-stretch overflow-hidden pb-4 pt-0"
              : "flex-grow items-center justify-center p-4 py-6"
          )}>
          {renderBackground()}
          <div
            className={cn(
              "flex w-full",
              useNaturalHeight
                ? "h-full min-h-0 flex-1 flex-col items-stretch overflow-hidden"
                : "h-full items-center justify-center"
            )}>
            {children}
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div
        className={cn(
          "relative flex flex-col overflow-hidden",
          useNaturalHeight ? "h-dvh items-stretch" : "min-h-dvh items-center justify-center"
        )}>
        {renderBackground()}
        <div className={cn("relative w-full", useNaturalHeight && "flex min-h-0 flex-1 flex-col")}>
          {children}
        </div>
      </div>
    );
  }
};
