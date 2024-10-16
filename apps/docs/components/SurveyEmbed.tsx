import React from "react";

interface SurveyEmbedProps {
  surveyUrl: string;
}

const SurveyEmbed: React.FC<SurveyEmbedProps> = ({ surveyUrl }) => {
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
        src={surveyUrl}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
};

export default SurveyEmbed;
