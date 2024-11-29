import { useState } from "react";

interface Translations {
  whyAmISeeingThisAd: string;
  adExplanation: string;
  adDescription: string;
  showLess: string;
}

const AdExplanation = ({ translations }: { translations: Translations }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      style={{
        textAlign: "center",
        backgroundColor: "#fff", // Match app background
        borderRadius: "8px", // Rounded corners for consistency
        padding: "10px", // Consistent padding
        maxWidth: "300px", // Optional: Adjust to match app layout
        margin: "auto", // Center the component
      }}>
      {!isExpanded ? (
        // Compact View: Button Only
        <div className="mx-auto flex min-h-[50px] max-w-sm items-center justify-center rounded-lg bg-white p-2">
          <button
            onClick={toggleExpand}
            dir="auto"
            type="button"
            className="fb-bg-brand fb-border-submit-button-border fb-text-on-brand focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-2 fb-py-1 fb-text-sm fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
            style={{ fontSize: "0.9rem", margin: "0" }}>
            {translations.whyAmISeeingThisAd}
          </button>
        </div>
      ) : (
        // Expanded View: Full Explanation
        <div>
          <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#333" }}>
            {translations.adExplanation}
          </div>
          <div style={{ color: "#666", fontSize: "0.85rem", marginBottom: "8px" }}>
            {translations.adDescription}
          </div>
          <div className="mx-auto flex min-h-[50px] max-w-sm items-center justify-center rounded-lg bg-white p-2">
            <button
              onClick={toggleExpand}
              className="fb-bg-brand fb-border-submit-button-border fb-text-on-brand focus:fb-ring-focus fb-rounded-custom fb-px-2 fb-py-1 fb-text-sm fb-font-medium fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
              style={{ fontSize: "0.9rem", margin: "0" }}>
              {translations.showLess}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdExplanation;
