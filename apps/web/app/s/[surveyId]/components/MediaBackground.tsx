"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

interface MediaBackgroundProps {
  children: React.ReactNode;
  survey: TSurvey;
  product: TProduct;
  isEditorView?: boolean;
  isMobilePreview?: boolean;
  ContentRef?: React.RefObject<HTMLDivElement>;
}

export const MediaBackground: React.FC<MediaBackgroundProps> = ({
  children,
  product,
  survey,
  isEditorView = false,
  isMobilePreview = false,
  ContentRef,
}) => {
  const animatedBackgroundRef = useRef<HTMLVideoElement>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);

  // get the background from either the survey or the product styling
  const background = useMemo(() => {
    // allow style overwrite is disabled from the product
    if (!product.styling.allowStyleOverwrite) {
      return product.styling.background;
    }

    // allow style overwrite is enabled from the product
    if (product.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return product.styling.background;
      }

      // survey style overwrite is enabled
      return survey.styling.background;
    }

    return product.styling.background;
  }, [product.styling.allowStyleOverwrite, product.styling.background, survey.styling]);

  useEffect(() => {
    if (background?.bgType === "animation" && animatedBackgroundRef.current) {
      const video = animatedBackgroundRef.current;
      const onCanPlayThrough = () => setBackgroundLoaded(true);
      video.addEventListener("canplaythrough", onCanPlayThrough);
      video.src = background?.bg || "";

      // Cleanup
      return () => video.removeEventListener("canplaythrough", onCanPlayThrough);
    } else if (background?.bgType === "image" && background?.bg) {
      // For images, we create a new Image object to listen for the 'load' event
      const img = new Image();
      img.onload = () => setBackgroundLoaded(true);
      img.src = background?.bg;
    } else {
      // For colors or any other types, set to loaded immediately
      setBackgroundLoaded(true);
    }
  }, [background?.bg, background?.bgType]);

  const baseClasses = "absolute inset-0 h-full w-full transition-opacity duration-500";
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
        return (
          <div
            className={`${baseClasses} ${loadedClass} bg-cover bg-center`}
            style={{ backgroundImage: `url(${background?.bg})`, filter: `${filterStyle}` }}
          />
        );
      default:
        return <div className={`${baseClasses} ${loadedClass} bg-white`} />;
    }
  };

  const renderContent = () => (
    <div className="no-scrollbar absolute flex h-full w-full items-center justify-center overflow-y-auto">
      {children}
    </div>
  );

  if (isMobilePreview) {
    return (
      <div
        ref={ContentRef}
        className={`relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-3xl border-8 border-slate-500 ${getFilterStyle()}`}>
        {/* below element is use to create notch for the mobile device mockup   */}
        <div className="absolute left-1/2 right-1/2 top-0 z-20 h-4 w-1/2 -translate-x-1/2 transform rounded-b-md bg-slate-500"></div>
        {renderBackground()}
        {renderContent()}
      </div>
    );
  } else if (isEditorView) {
    return (
      <div ref={ContentRef} className="flex flex-grow flex-col overflow-y-auto rounded-b-lg">
        <div className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6">
          {renderBackground()}
          <div className="flex h-full w-full items-center justify-center">{children}</div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-2">
        {renderBackground()}
        <div className="relative w-full">{children}</div>
      </div>
    );
  }
};
