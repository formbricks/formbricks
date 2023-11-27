"use client";

import { TSurvey } from "@formbricks/types/surveys";
import React from "react";

const MediaBackground = ({
  children,
  survey,
  isEditorView,
  ContentRef,
}: {
  children: React.ReactNode;
  survey: TSurvey;
  isEditorView?: boolean;
  ContentRef?: React.RefObject<HTMLDivElement>;
}) => {
  const getFilterStyle = () => {
    return survey.surveyBackground?.brightness
      ? { filter: `brightness(${survey.surveyBackground.brightness}%)` }
      : {};
  };

  const renderBackground = () => {
    const filterStyle = getFilterStyle();

    switch (survey.surveyBackground?.bgType) {
      case "color":
        // Ensure backgroundColor is applied directly
        return (
          <div
            style={{
              ...filterStyle,
              backgroundColor: survey.surveyBackground.bg || "#ffff", // Default color
              width: "100%",
              height: "100%",
            }}
            className="absolute inset-0"
          />
        );
      case "animation":
        return (
          <video
            muted
            loop
            autoPlay
            style={filterStyle}
            className="absolute inset-0 h-full w-full object-cover">
            <source src={survey.surveyBackground.bg || ""} type="video/mp4" />
          </video>
        );
      case "image":
        return (
          <div
            style={{
              ...filterStyle,
              backgroundImage: `url(${survey.surveyBackground.bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            className="absolute inset-0 h-full w-full"
          />
        );
      default:
        return <div style={{ backgroundColor: "#ffff" }} className="absolute inset-0 h-full w-full" />;
    }
  };

  const commonClasses = "relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6";
  const previewClasses = "flex flex-grow flex-col overflow-y-auto rounded-b-lg";

  return (
    <>
      {isEditorView ? (
        <div className={previewClasses} ref={ContentRef}>
          <div className={commonClasses}>
            {renderBackground()}
            <div className="flex h-full w-full items-center justify-center">{children}</div>
          </div>
        </div>
      ) : (
        <div className={`flex min-h-screen flex-col items-center justify-center px-2`}>
          {renderBackground()}
          <div className="relative w-full">{children}</div>
        </div>
      )}
    </>
  );
};

export default MediaBackground;
