"use client";

import { TSurvey } from "@formbricks/types/surveys";

import React from "react";

const BackgroundView = ({
  children,
  survey,
  isPreview,
  ContentRef,
  LegalFooter,
}: {
  children: React.ReactNode;
  survey: TSurvey;
  isPreview: boolean;
  ContentRef?: React.RefObject<HTMLDivElement>;
  LegalFooter?: React.ComponentType<{
    bgColor?: string | null;
  }>;
}) => {
  if (isPreview) {
    if (survey.surveyBackground && survey.surveyBackground.bgType === "color") {
      return (
        <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
          <div className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6">
            <div
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                backgroundColor: survey.surveyBackground.bg as string,
                filter: survey.surveyBackground.brightness
                  ? `brightness(${survey.surveyBackground.brightness}%)`
                  : "none",
              }}></div>
            <div className="flex h-full w-full items-center justify-center">{children}</div>
          </div>
        </div>
      );
    }

    if (survey.surveyBackground && survey.surveyBackground.bgType === "animation") {
      return (
        <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
          <div
            className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6"
            style={{
              background: `url(${survey.surveyBackground.bg}) no-repeat center center fixed`,
            }}>
            <video
              muted
              loop
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                filter: survey.surveyBackground?.brightness
                  ? `brightness(${survey.surveyBackground.brightness}%)`
                  : "none",
              }}>
              <source src={survey.surveyBackground.bg || ""} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="flex h-full w-full items-center justify-center">{children}</div>
          </div>
        </div>
      );
    }

    if (survey.surveyBackground && survey.surveyBackground.bgType === "image") {
      return (
        <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
          <div className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6">
            <div
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                backgroundImage: `url(${survey.surveyBackground.bg})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                filter: survey.surveyBackground.brightness
                  ? `brightness(${survey.surveyBackground.brightness}%)`
                  : "none",
              }}></div>
            <div className="flex h-full w-full items-center justify-center">{children}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
        <div className="relative flex w-full flex-grow flex-col items-center justify-center p-4 py-6">
          <div
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              backgroundColor: "#ffff",
              filter: survey.surveyBackground?.brightness
                ? `brightness(${survey.surveyBackground.brightness}%)`
                : "none",
            }}></div>
          <div className="flex h-full w-full items-center justify-center">{children}</div>
        </div>
      </div>
    );
  } else {
    if (survey.surveyBackground && survey.surveyBackground.bgType === "color") {
      return (
        <>
          <div
            className={`flex min-h-screen flex-col items-center justify-center px-2`}
            style={{
              backgroundColor: `${survey.surveyBackground.bg}`,
              filter: survey.surveyBackground.brightness
                ? `brightness(${survey.surveyBackground.brightness}%)`
                : "none",
            }}>
            <div className="relative w-full">{children}</div>
          </div>
          {LegalFooter && <LegalFooter bgColor={survey.surveyBackground.bg || "#ffff"} />}
        </>
      );
    }

    if (survey.surveyBackground && survey.surveyBackground.bgType === "animation") {
      return (
        <>
          <div className={`flex min-h-screen flex-col items-center justify-center px-2`}>
            <video
              muted
              loop
              autoPlay
              className="fixed left-0 top-0 -z-50 h-full w-full  object-cover"
              style={{
                filter: survey.surveyBackground.brightness
                  ? `brightness(${survey.surveyBackground.brightness}%)`
                  : "none",
              }}>
              <source src={survey.surveyBackground.bg || ""} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="relative w-full">{children}</div>
          </div>
          {LegalFooter && <LegalFooter bgColor={survey.surveyBackground.bg || "#ffff"} />}
        </>
      );
    }

    if (survey.surveyBackground && survey.surveyBackground.bgType === "image") {
      return (
        <div>
          <div
            className={`flex min-h-screen flex-col items-center justify-center px-2`}
            style={{
              backgroundImage: `url(${survey.surveyBackground.bg})`,
              backgroundSize: "cover",
              filter: survey.surveyBackground.brightness
                ? `brightness(${survey.surveyBackground.brightness}%)`
                : "none",
            }}>
            <div className="relative w-full">{children}</div>
          </div>
          {LegalFooter && <LegalFooter bgColor={survey.surveyBackground.bg || "#ffff"} />}
        </div>
      );
    }

    return (
      <div>
        <div
          className={`flex min-h-screen flex-col items-center justify-center px-2`}
          style={{
            backgroundColor: `#ffff`,
            filter: survey.surveyBackground?.brightness
              ? `brightness(${survey.surveyBackground.brightness}%)`
              : "none",
          }}>
          <div className="relative w-full">{children}</div>
        </div>
        {LegalFooter && <LegalFooter bgColor={"#ffff"} />}
      </div>
    );
  }
};

export default BackgroundView;
