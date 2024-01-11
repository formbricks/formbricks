"use client";

import React, { useEffect, useRef } from "react";

import { TSurvey } from "@formbricks/types/surveys";

interface MediaBackgroundProps {
  children: React.ReactNode;
  survey: TSurvey;
  isEditorView?: boolean;
  isMobilePreview?: boolean;
  ContentRef?: React.RefObject<HTMLDivElement>;
}

export const MediaBackground: React.FC<MediaBackgroundProps> = ({
  children,
  survey,
  isEditorView = false,
  isMobilePreview = false,
  ContentRef,
}) => {
  const animatedBackgroundRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (survey.styling?.background?.bgType === "animation") {
      if (animatedBackgroundRef.current && survey.styling?.background?.bg) {
        animatedBackgroundRef.current.src = survey.styling?.background?.bg;
        animatedBackgroundRef.current.play();
      }
    }
  }, [survey.styling?.background?.bg, survey.styling?.background?.bgType]);

  const getFilterStyle = () => {
    return survey.styling?.background?.brightness
      ? `brightness(${survey.styling?.background?.brightness}%)`
      : "brightness(100%)";
  };

  const renderBackground = () => {
    const filterStyle = getFilterStyle();
    const baseClasses = "absolute inset-0 h-full w-full";

    switch (survey.styling?.background?.bgType) {
      case "color":
        return (
          <div
            className={`${baseClasses}`}
            style={{ backgroundColor: survey.styling?.background?.bg || "#ffff", filter: `${filterStyle}` }}
          />
        );
      case "animation":
        return (
          <video
            ref={animatedBackgroundRef}
            muted
            loop
            autoPlay
            className={`${baseClasses} object-cover`}
            style={{ filter: `${filterStyle}` }}>
            <source src={survey.styling?.background?.bg || ""} type="video/mp4" />
          </video>
        );
      case "image":
        return (
          <div
            className={`${baseClasses} bg-cover bg-center`}
            style={{ backgroundImage: `url(${survey.styling?.background?.bg})`, filter: `${filterStyle}` }}
          />
        );
      default:
        return <div className={`${baseClasses} bg-white`} />;
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
