import { JSX } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

// Utility function to render hyperlinked content
export const renderHyperlinkedContent = (data: string): JSX.Element[] => {
  // More specific URL pattern
  const urlPattern =
    /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*[-a-zA-Z0-9@%_\+~#//=])?)/g;
  const parts = data.split(urlPattern);

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return parts.map((part, index) =>
    part.match(urlPattern) && isValidUrl(part) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500">
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};

export const getSurveyUrl = (survey: TSurvey, publicDomain: string, language: string): string => {
  let url = `${publicDomain}/s/${survey.id}`;
  const queryParams: string[] = [];

  if (language !== "default") {
    queryParams.push(`lang=${language}`);
  }

  if (queryParams.length) {
    url += `?${queryParams.join("&")}`;
  }

  return url;
};
