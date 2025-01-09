import React from "react";

interface SurveyEmbedProps {
  surveyUrl: string;
}

export default function SurveyEmbed({ surveyUrl }: SurveyEmbedProps): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        height: "90vh",
        maxHeight: "100vh",
        overflow: "auto",
        borderRadius: "12px",
      }}>
      <iframe
        title="Survey Embed"
        src={surveyUrl}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}

